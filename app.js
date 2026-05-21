const pdfInput = document.querySelector("#pdfInput");
const fileList = document.querySelector("#fileList");
const generateBtn = document.querySelector("#generateBtn");
const emptyState = document.querySelector("#emptyState");
const activeEditor = document.querySelector("#activeEditor");
const fontSizeInput = document.querySelector("#fontSize");
const boldBtn = document.querySelector("#boldBtn");
const italicBtn = document.querySelector("#italicBtn");
const rotatePreviewBtn = document.querySelector("#rotatePreviewBtn");
const imageInput = document.querySelector("#imageInput");
const rotateImageBtn = document.querySelector("#rotateImageBtn");
const showStampToggle = document.querySelector("#showStampToggle");
const addInfoBoxBtn = document.querySelector("#addInfoBoxBtn");
const copyInfoBoxesBtn = document.querySelector("#copyInfoBoxesBtn");
const pasteInfoBoxesBtn = document.querySelector("#pasteInfoBoxesBtn");
const alignLeftBtn = document.querySelector("#alignLeftBtn");
const alignCenterBtn = document.querySelector("#alignCenterBtn");
const alignRightBtn = document.querySelector("#alignRightBtn");
const pdfTextList = document.querySelector("#pdfTextList");
const pdfTextEmpty = document.querySelector("#pdfTextEmpty");
const previewStage = document.querySelector("#previewStage");
const pdfCanvas = document.querySelector("#pdfCanvas");
const pdfTextOverlayLayer = document.querySelector("#pdfTextOverlayLayer");
const stampLayer = document.querySelector("#stampLayer");
const imageBox = document.querySelector("#imageBox");
const imageStamp = document.querySelector("#imageStamp");

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;
const canvasContext = pdfCanvas.getContext("2d");
const DEFAULT_TEXT_HTML = "Digite as informacoes aqui";
const state = {
  items: [],
  activeId: null,
  renderTask: null,
  previewScale: 1,
  imageAsset: null,
  activePdfTextBlockId: null,
  activeInfoBoxId: null,
  selectedInfoBoxIds: [],
  copiedInfoBoxes: []
};

pdfInput.addEventListener("change", handleFiles);
generateBtn.addEventListener("click", generateMergedPdf);
fontSizeInput.addEventListener("input", handleFontSizeChange);
fontSizeInput.addEventListener("change", handleFontSizeChange);
boldBtn.addEventListener("mousedown", event => event.preventDefault());
italicBtn.addEventListener("mousedown", event => event.preventDefault());
boldBtn.addEventListener("click", () => applyTextStyle({ bold: true }));
italicBtn.addEventListener("click", () => applyTextStyle({ italic: true }));
alignLeftBtn.addEventListener("click", () => applyTextStyle({ textAlign: "left" }));
alignCenterBtn.addEventListener("click", () => applyTextStyle({ textAlign: "center" }));
alignRightBtn.addEventListener("click", () => applyTextStyle({ textAlign: "right" }));
addInfoBoxBtn.addEventListener("click", handleAddInfoBox);
copyInfoBoxesBtn.addEventListener("click", handleCopyInfoBoxes);
pasteInfoBoxesBtn.addEventListener("click", handlePasteInfoBoxes);
stampLayer.addEventListener("input", handleStampInput);
stampLayer.addEventListener("focusin", handleStampFocusIn);
stampLayer.addEventListener("keyup", saveTextSelection);
stampLayer.addEventListener("mouseup", saveTextSelection);
stampLayer.addEventListener("blur", saveTextSelection, true);
document.addEventListener("selectionchange", saveTextSelection);
rotatePreviewBtn.addEventListener("click", async () => {
  const item = getActiveItem();
  if (!item) return;

  item.previewRotation = normalizeDegrees(item.previewRotation + 90);
  await showItem(item.id);
});
imageInput.addEventListener("change", handleImageFile);
rotateImageBtn.addEventListener("click", () => {
  const item = getActiveItem();
  if (!item) return;

  item.imageRotation = normalizeDegrees(item.imageRotation + 90);
  syncImageStamp();
});
showStampToggle.addEventListener("change", () => {
  const item = getActiveItem();
  if (!item) return;

  item.showNewInfo = showStampToggle.checked;
  renderInfoBoxes();
});
pdfTextList?.addEventListener("input", handlePdfTextInput);
pdfTextOverlayLayer.addEventListener("input", handlePdfOverlayInput);
pdfTextList?.addEventListener("focusin", handlePdfTextFocusIn);
pdfTextOverlayLayer.addEventListener("focusin", handlePdfTextFocusIn);
pdfTextList?.addEventListener("pointerdown", handlePdfTextPointerDown);
pdfTextOverlayLayer.addEventListener("pointerdown", handlePdfTextPointerDown);
window.addEventListener("resize", () => {
  fitPreviewToShell();
  renderInfoBoxes();
  positionImageFromRatios();
  renderPdfTextOverlays();
});

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function createInfoBox(overrides = {}) {
  return {
    id: createId(),
    textHtml: DEFAULT_TEXT_HTML,
    fontSize: 14,
    textAlign: "left",
    xRatio: 0.08,
    yRatio: 0.08,
    textWidth: 360,
    textHeight: 120,
    ...overrides
  };
}

function ensureInfoBoxes(item) {
  if (!item) return [];

  if (!Array.isArray(item.infoBoxes)) {
    item.infoBoxes = [createInfoBox({
      textHtml: item.textHtml ?? DEFAULT_TEXT_HTML,
      fontSize: item.fontSize ?? 14,
      textAlign: item.textAlign ?? "left",
      xRatio: item.xRatio ?? 0.08,
      yRatio: item.yRatio ?? 0.08,
      textWidth: item.textWidth ?? 360,
      textHeight: item.textHeight ?? 120
    })];
  }

  return item.infoBoxes;
}

function getInfoBoxById(item, id) {
  return ensureInfoBoxes(item).find(box => box.id === id) || null;
}

function getActiveInfoBox(item = getActiveItem()) {
  const infoBoxes = ensureInfoBoxes(item);
  return infoBoxes.find(box => box.id === state.activeInfoBoxId) || infoBoxes[0] || null;
}

function getActiveInfoBoxElement() {
  if (!state.activeInfoBoxId) return null;
  return stampLayer.querySelector(`[data-info-box-id="${state.activeInfoBoxId}"] .rich-text`);
}

function getSelectedInfoBoxes(item = getActiveItem()) {
  return ensureInfoBoxes(item).filter(box => state.selectedInfoBoxIds.includes(box.id));
}

function setSelectedInfoBoxes(ids, item = getActiveItem()) {
  const validIds = ensureInfoBoxes(item).map(box => box.id);
  state.selectedInfoBoxIds = [...new Set(ids)].filter(id => validIds.includes(id));
}

function syncInfoBoxActionButtons() {
  if (copyInfoBoxesBtn) {
    copyInfoBoxesBtn.disabled = getSelectedInfoBoxes().length === 0;
  }

  if (pasteInfoBoxesBtn) {
    pasteInfoBoxesBtn.disabled = state.copiedInfoBoxes.length === 0 || !getActiveItem();
  }

  syncAlignmentButtons();
}

function syncAlignmentButtons() {
  const textAlign = getActiveInfoBox()?.textAlign || "left";
  alignLeftBtn.classList.toggle("is-active", textAlign === "left");
  alignCenterBtn.classList.toggle("is-active", textAlign === "center");
  alignRightBtn.classList.toggle("is-active", textAlign === "right");
}

function cloneInfoBoxData(box) {
  return {
    textHtml: box.textHtml,
    fontSize: box.fontSize,
    textAlign: box.textAlign,
    xRatio: box.xRatio,
    yRatio: box.yRatio,
    textWidth: box.textWidth,
    textHeight: box.textHeight
  };
}

function createPageItem(fileName, bytes, pageIndex, sourceId) {
  return {
    id: createId(),
    sourceId,
    fileName,
    bytes,
    pageIndex,
    pageLabel: `Pagina ${pageIndex + 1}`,
    textHtml: DEFAULT_TEXT_HTML,
    fontSize: 14,
    xRatio: 0.08,
    yRatio: 0.08,
    textWidth: 360,
    textHeight: 120,
    showNewInfo: true,
    previewRotation: 0,
    autoPreviewRotation: null,
    imageEnabled: true,
    imageXRatio: 0.16,
    imageYRatio: 0.24,
    imageWidth: 180,
    imageHeight: 120,
    imageRotation: 0,
    infoBoxes: [createInfoBox()],
    pdfTextBlocks: []
  };
}

function getActiveItem() {
  return state.items.find(item => item.id === state.activeId) || state.items[0] || null;
}

async function handleFiles(event) {
  const files = Array.from(event.target.files || []).filter(file => file.type === "application/pdf");
  if (!files.length) return;

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
    const pdf = await loadingTask.promise;
    const sourceId = createId();

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
      state.items.push(createPageItem(file.name, bytes, pageIndex, sourceId));
    }

    await loadingTask.destroy();
  }

  state.activeId = getActiveItem()?.id || null;

  renderFileList();
  await showItem(state.activeId);
  generateBtn.disabled = false;
  pdfInput.value = "";
}

function renderFileList() {
  fileList.innerHTML = "";

  state.items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = `file-item${item.id === state.activeId ? " active" : ""}`;
    row.draggable = true;
    row.dataset.id = item.id;
    row.innerHTML = `
      <span class="drag-handle" aria-hidden="true">::</span>
      <span>
        <strong>${escapeHtml(item.fileName)}</strong>
        <span>${escapeHtml(item.pageLabel)} · Ordem ${index + 1}</span>
      </span>
      <label class="image-target">
        <input type="checkbox" data-image-target="${item.id}" ${item.imageEnabled ? "checked" : ""}>
        Imagem
      </label>
      <button type="button" class="remove-page-button" data-remove-page="${item.id}" aria-label="Remover ${escapeHtml(item.pageLabel)} de ${escapeHtml(item.fileName)}">Remover</button>
    `;
    row.addEventListener("dragstart", handlePdfDragStart);
    row.addEventListener("dragover", handlePdfDragOver);
    row.addEventListener("drop", handlePdfDrop);
    row.addEventListener("dragend", handlePdfDragEnd);
    row.addEventListener("click", event => {
      if (event.target.closest(".image-target")) return;
      showItem(item.id);
    });
    const checkbox = row.querySelector("[data-image-target]");
    checkbox.addEventListener("pointerdown", event => event.stopPropagation());
    checkbox.addEventListener("click", event => event.stopPropagation());
    checkbox.addEventListener("change", event => {
      item.imageEnabled = event.target.checked;
      if (item.id === state.activeId) {
        syncImageStamp();
      }
    });
    const removeButton = row.querySelector("[data-remove-page]");
    removeButton.addEventListener("pointerdown", event => event.stopPropagation());
    removeButton.addEventListener("click", async event => {
      event.stopPropagation();
      await removePageItem(item.id);
    });
    fileList.appendChild(row);
  });
}

async function removePageItem(id) {
  const index = state.items.findIndex(item => item.id === id);
  if (index < 0) return;

  const wasActive = state.activeId === id;
  state.items.splice(index, 1);

  if (!state.items.length) {
    clearEditorState();
    return;
  }

  if (!wasActive) {
    renderFileList();
    generateBtn.disabled = false;
    return;
  }

  const nextIndex = Math.min(index, state.items.length - 1);
  await showItem(state.items[nextIndex].id);
  generateBtn.disabled = false;
}

function clearEditorState() {
  state.activeId = null;
  state.activePdfTextBlockId = null;
  state.activeInfoBoxId = null;
  state.selectedInfoBoxIds = [];
  renderFileList();
  emptyState.classList.remove("hidden");
  activeEditor.classList.add("hidden");
  generateBtn.disabled = true;
  pdfCanvas.width = 0;
  pdfCanvas.height = 0;
  pdfCanvas.style.width = "0px";
  pdfCanvas.style.height = "0px";
  previewStage.style.width = "0px";
  previewStage.style.height = "0px";
  pdfTextOverlayLayer.innerHTML = "";
  stampLayer.innerHTML = "";
  pdfTextList.innerHTML = "";
  pdfTextEmpty.classList.remove("hidden");
  imageBox.classList.add("hidden");
  syncInfoBoxActionButtons();
}

async function showItem(id) {
  const item = state.items.find(pdf => pdf.id === id) || state.items[0];
  if (!item) return;

  state.activeId = item.id;
  state.activePdfTextBlockId = null;
  ensureInfoBoxes(item);
  state.activeInfoBoxId = getActiveInfoBox(item)?.id || null;
  setSelectedInfoBoxes(state.activeInfoBoxId ? [state.activeInfoBoxId] : [], item);
  emptyState.classList.add("hidden");
  activeEditor.classList.remove("hidden");
  renderFileList();
  fontSizeInput.value = getActiveInfoBox(item)?.fontSize || 14;
  showStampToggle.checked = item.showNewInfo;
  syncImageStamp();
  await renderPreview(item);
  renderPdfTextEditor();
  fitPreviewToShell();
  renderInfoBoxes();
  positionImageFromRatios();
  renderPdfTextOverlays();
  syncInfoBoxActionButtons();
}

async function renderPreview(item) {
  const loadingTask = pdfjsLib.getDocument({ data: item.bytes.slice(0) });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(item.pageIndex + 1);
  const autoPreviewRotation = getAutoLandscapeRotation(page, 1.25);
  const viewport = getLandscapeViewport(page, item.previewRotation, autoPreviewRotation, 1.25);

  pdfCanvas.width = viewport.width;
  pdfCanvas.height = viewport.height;
  pdfCanvas.style.width = `${viewport.width}px`;
  pdfCanvas.style.height = `${viewport.height}px`;
  previewStage.style.width = `${viewport.width}px`;
  previewStage.style.height = `${viewport.height}px`;

  if (state.renderTask) {
    state.renderTask.cancel();
    try {
      await state.renderTask.promise;
    } catch (error) {
      if (error?.name !== "RenderingCancelledException") throw error;
    }
  }

  state.renderTask = page.render({ canvasContext, viewport });
  try {
    await state.renderTask.promise;
    item.autoPreviewRotation = autoPreviewRotation;
    item.pdfTextBlocks = await extractPdfTextBlocks(page, item, viewport);
    renderPdfTextEditor();
    renderPdfTextOverlays();
    fitPreviewToShell();
  } catch (error) {
    if (error?.name !== "RenderingCancelledException") throw error;
  } finally {
    state.renderTask = null;
    await loadingTask.destroy();
  }
}

function fitPreviewToShell() {
  const shell = previewStage.parentElement;
  previewStage.style.transform = "scale(1)";
  const availableWidth = Math.max(1, shell.clientWidth - 36);
  const availableHeight = Math.max(1, shell.clientHeight - 36);
  const scale = Math.min(1, availableWidth / previewStage.offsetWidth, availableHeight / previewStage.offsetHeight);

  state.previewScale = scale;
  previewStage.style.transform = `scale(${scale})`;
  shell.style.minHeight = `${Math.ceil(previewStage.offsetHeight * scale) + 36}px`;
}

function getLandscapeViewport(page, previewRotation, autoPreviewRotation, scale) {
  const baseRotation = Number.isFinite(page.rotate) ? page.rotate : 0;
  const rotation = normalizeDegrees(baseRotation + autoPreviewRotation + previewRotation);
  return page.getViewport({ scale, rotation });
}

function getAutoLandscapeRotation(page, scale) {
  const baseRotation = Number.isFinite(page.rotate) ? page.rotate : 0;
  const viewport = page.getViewport({ scale, rotation: baseRotation });
  return viewport.height > viewport.width ? 90 : 0;
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function forceCanvasLandscape() {
  if (pdfCanvas.width >= pdfCanvas.height) return;

  const source = document.createElement("canvas");
  source.width = pdfCanvas.width;
  source.height = pdfCanvas.height;
  source.getContext("2d").drawImage(pdfCanvas, 0, 0);

  pdfCanvas.width = source.height;
  pdfCanvas.height = source.width;
  canvasContext.save();
  canvasContext.translate(pdfCanvas.width, 0);
  canvasContext.rotate(Math.PI / 2);
  canvasContext.drawImage(source, 0, 0);
  canvasContext.restore();

  pdfCanvas.style.width = `${pdfCanvas.width}px`;
  pdfCanvas.style.height = `${pdfCanvas.height}px`;
  previewStage.style.width = `${pdfCanvas.width}px`;
  previewStage.style.height = `${pdfCanvas.height}px`;
}

function forceRenderedContentLandscape() {
  const bounds = getRenderedContentBounds();
  if (!bounds) return 0;

  if (bounds.height > bounds.width) {
    rotateCanvasClockwise();
    return 90;
  }

  return 0;
}

function getRenderedContentBounds() {
  const width = pdfCanvas.width;
  const height = pdfCanvas.height;
  const step = Math.max(2, Math.floor(Math.max(width, height) / 900));
  const image = canvasContext.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const r = image[index];
      const g = image[index + 1];
      const b = image[index + 2];
      const a = image[index + 3];

      if (a > 20 && (r < 245 || g < 245 || b < 245)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function rotateCanvasClockwise() {
  const source = document.createElement("canvas");
  source.width = pdfCanvas.width;
  source.height = pdfCanvas.height;
  source.getContext("2d").drawImage(pdfCanvas, 0, 0);

  pdfCanvas.width = source.height;
  pdfCanvas.height = source.width;
  canvasContext.save();
  canvasContext.translate(pdfCanvas.width, 0);
  canvasContext.rotate(Math.PI / 2);
  canvasContext.drawImage(source, 0, 0);
  canvasContext.restore();

  pdfCanvas.style.width = `${pdfCanvas.width}px`;
  pdfCanvas.style.height = `${pdfCanvas.height}px`;
  previewStage.style.width = `${pdfCanvas.width}px`;
  previewStage.style.height = `${pdfCanvas.height}px`;

  if (maxX < minX || maxY < minY) return null;

  return {
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function rotateCanvasClockwise() {
  const source = document.createElement("canvas");
  source.width = pdfCanvas.width;
  source.height = pdfCanvas.height;
  source.getContext("2d").drawImage(pdfCanvas, 0, 0);

  pdfCanvas.width = source.height;
  pdfCanvas.height = source.width;
  canvasContext.save();
  canvasContext.translate(pdfCanvas.width, 0);
  canvasContext.rotate(Math.PI / 2);
  canvasContext.drawImage(source, 0, 0);
  canvasContext.restore();

  pdfCanvas.style.width = `${pdfCanvas.width}px`;
  pdfCanvas.style.height = `${pdfCanvas.height}px`;
  previewStage.style.width = `${pdfCanvas.width}px`;
  previewStage.style.height = `${pdfCanvas.height}px`;
}

async function extractPdfTextBlocks(page, item, viewport) {
  const textContent = await page.getTextContent();
  const annotations = await page.getAnnotations();
  const textBlocks = [];
  const scale = viewport.scale;
  const tolerance = 6;
  const previousBlocks = item.pdfTextBlocks || [];

  textContent.items.forEach(textItem => {
    if (!textItem.str || !textItem.str.trim()) return;

    const transform = pdfjsLib.Util.transform(viewport.transform, textItem.transform);
    const styleInfo = getPdfTextStyleInfo(textItem.fontName || "");
    const fontSize = Math.max(8, Math.abs(transform[0]) || Math.abs(transform[3]) || textItem.height || 12);
    const left = transform[4];
    const top = Math.max(0, transform[5] - fontSize);
    const width = Math.max(fontSize * 0.6, textItem.width * scale);
    const height = Math.max(fontSize * 1.25, 12);
    const lastBlock = textBlocks[textBlocks.length - 1];

    if (lastBlock && Math.abs(lastBlock.top - top) < tolerance && left <= lastBlock.left + lastBlock.width + (fontSize * 1.5)) {
      const gap = left - (lastBlock.left + lastBlock.width);
      if (gap > fontSize * 0.35 && !lastBlock.originalText.endsWith(" ")) {
        lastBlock.originalText += " ";
      }
      lastBlock.originalText += textItem.str;
      lastBlock.width = Math.max(lastBlock.width, (left + width) - lastBlock.left);
      lastBlock.height = Math.max(lastBlock.height, height);
      lastBlock.fontSize = Math.max(lastBlock.fontSize, fontSize);
      lastBlock.isBold = lastBlock.isBold || styleInfo.isBold;
      lastBlock.isItalic = lastBlock.isItalic || styleInfo.isItalic;
      return;
    }

    textBlocks.push({
      sourceType: "text",
      left,
      top,
      width,
      height,
      fontSize,
      fontName: textItem.fontName || "",
      isBold: styleInfo.isBold,
      isItalic: styleInfo.isItalic,
      originalText: textItem.str
    });
  });

  const annotationBlocks = annotations
    .filter(annotation => annotation.rect && isEditableAnnotation(annotation))
    .map(annotation => mapAnnotationToBlock(annotation, viewport))
    .filter(Boolean);

  return [...textBlocks, ...annotationBlocks]
    .map(block => hydratePdfTextBlock(block, previousBlocks))
    .filter(block => block.originalText.trim());
}

function isEditableAnnotation(annotation) {
  return ["FreeText", "Text", "Widget"].includes(annotation.subtype) && getAnnotationText(annotation).trim();
}

function getAnnotationText(annotation) {
  return String(annotation.fieldValue || annotation.contentsObj?.str || annotation.contents || annotation.titleObj?.str || "");
}

function mapAnnotationToBlock(annotation, viewport) {
  const [x1, y1, x2, y2] = annotation.rect;
  const width = Math.abs(x2 - x1) * viewport.scale;
  const height = Math.abs(y2 - y1) * viewport.scale;
  const left = Math.min(x1, x2) * viewport.scale;
  const top = viewport.height - (Math.max(y1, y2) * viewport.scale);
  const fontSize = Math.max(10, Math.min(18, height * 0.6));
  const originalText = getAnnotationText(annotation).trim();

  if (!originalText) return null;

  return {
    sourceType: "annotation",
    annotationSubtype: annotation.subtype,
    left,
    top,
    width: Math.max(width, fontSize * 2),
    height: Math.max(height, fontSize * 1.4),
    fontSize,
    originalText
  };
}

function hydratePdfTextBlock(block, previousBlocks) {
  const signature = createPdfTextBlockSignature(block);
  const previous = previousBlocks.find(candidate => candidate.signature === signature)
    || previousBlocks.find(candidate => candidate.sourceType === block.sourceType
      && candidate.originalText === block.originalText
      && Math.abs(candidate.xRatio - getRatio(block.left, previewStage.clientWidth)) < 0.01
      && Math.abs(candidate.yRatio - getRatio(block.top, previewStage.clientHeight)) < 0.01);

  return {
    id: previous?.id || createId(),
    signature,
    sourceType: block.sourceType,
    annotationSubtype: block.annotationSubtype || null,
    fontName: block.fontName || previous?.fontName || "",
    isBold: block.isBold ?? previous?.isBold ?? false,
    isItalic: block.isItalic ?? previous?.isItalic ?? false,
    originalText: block.originalText,
    text: previous ? previous.text : block.originalText,
    xRatio: getRatio(block.left, previewStage.clientWidth),
    yRatio: getRatio(block.top, previewStage.clientHeight),
    widthRatio: getRatio(block.width, previewStage.clientWidth, 0.1),
    heightRatio: getRatio(block.height, previewStage.clientHeight, 0.03),
    originalWidthRatio: getRatio(block.width, previewStage.clientWidth, 0.1),
    originalHeightRatio: getRatio(block.height, previewStage.clientHeight, 0.03),
    fontSizeRatio: getRatio(block.fontSize, previewStage.clientHeight, 0.02)
  };
}

function getPdfTextStyleInfo(fontName) {
  const normalized = String(fontName || "").toLowerCase();
  return {
    isBold: normalized.includes("bold"),
    isItalic: normalized.includes("italic") || normalized.includes("oblique")
  };
}

function getPdfTextFont(block, fonts, pageWidth, pageHeight) {
  const styleInfo = getPdfTextStyleInfo(block.fontName || "");
  const isBold = block.isBold ?? styleInfo.isBold;
  const isItalic = block.isItalic ?? styleInfo.isItalic;

  if (isBold && isItalic) return fonts.boldItalic;
  if (isBold) return fonts.bold;
  if (isItalic) return fonts.italic;

  const inferredFont = inferPdfTextFontFromWidth(block, fonts, pageWidth, pageHeight);
  if (inferredFont) return inferredFont;

  return fonts.regular;
}

function inferPdfTextFontFromWidth(block, fonts, pageWidth, pageHeight) {
  if (!block.originalText?.trim()) return null;

  const originalWidth = (block.originalWidthRatio || block.widthRatio || 0) * pageWidth;
  const originalFontSize = Math.max(6, (block.fontSizeRatio || 0) * pageHeight);
  if (!originalWidth || !originalFontSize) return null;

  const candidates = [
    { font: fonts.regular, key: "regular" },
    { font: fonts.bold, key: "bold" },
    { font: fonts.italic, key: "italic" },
    { font: fonts.boldItalic, key: "boldItalic" }
  ].map(candidate => ({
    ...candidate,
    diff: Math.abs(candidate.font.widthOfTextAtSize(block.originalText, originalFontSize) - originalWidth)
  }));

  candidates.sort((left, right) => left.diff - right.diff);
  const best = candidates[0];
  const regular = candidates.find(candidate => candidate.key === "regular");

  if (!best || !regular) return null;
  if (best.key === "regular") return null;

  return best.diff <= regular.diff * 0.92 ? best.font : null;
}

function createPdfTextBlockSignature(block) {
  return [
    block.sourceType,
    Math.round(block.left),
    Math.round(block.top),
    Math.round(block.width),
    Math.round(block.height),
    block.originalText
  ].join("::");
}

function getRatio(value, total, fallback = 0) {
  return total ? value / total : fallback;
}

function renderPdfTextEditor() {
  if (!pdfTextList || !pdfTextEmpty) return;

  const item = getActiveItem();
  pdfTextList.innerHTML = "";

  if (!item || !item.pdfTextBlocks.length) {
    pdfTextEmpty.classList.remove("hidden");
    return;
  }

  pdfTextEmpty.classList.add("hidden");

  item.pdfTextBlocks.forEach((block, index) => {
    const row = document.createElement("article");
    row.className = "pdf-text-item";
    row.innerHTML = `
      <div class="pdf-text-meta">${block.sourceType === "annotation" ? "Anotacao" : "Trecho"} ${index + 1}</div>
      <div class="pdf-text-original">${escapeHtml(block.originalText)}</div>
      <label>
        Novo texto
        <textarea data-pdf-text-index="${index}">${escapeHtml(block.text)}</textarea>
      </label>
    `;
    pdfTextList.appendChild(row);
  });

  syncPdfTextListStyles();
}

function handlePdfTextInput(event) {
  const input = event.target.closest("[data-pdf-text-index]");
  if (!input) return;

  const item = getActiveItem();
  if (!item) return;

  const index = Number(input.dataset.pdfTextIndex);
  const block = item.pdfTextBlocks[index];
  if (!block) return;

  block.text = input.value;
  syncPdfTextOverlayInput(block.id, block.text);
  renderPdfTextOverlays();
}

function syncFontSizeInputFromFocus() {
  const item = getActiveItem();
  if (!item) return;

  const block = getFocusedPdfTextBlock();
  if (block) {
    fontSizeInput.value = Math.round(Math.max(6, block.fontSizeRatio * previewStage.clientHeight || item.fontSize));
    return;
  }

  fontSizeInput.value = getActiveInfoBox(item)?.fontSize || 14;
}

function handleFontSizeChange() {
  applyTextStyle({ fontSize: normalizeFontSize(fontSizeInput.value) });
}

function setActivePdfTextBlock(target) {
  const item = getActiveItem();
  if (!item || !target) return;

  if (target.dataset.pdfOverlayId) {
    state.activePdfTextBlockId = target.dataset.pdfOverlayId;
    return;
  }

  if (target.dataset.pdfTextIndex !== undefined) {
    const block = item.pdfTextBlocks[Number(target.dataset.pdfTextIndex)];
    state.activePdfTextBlockId = block?.id || null;
  }
}

function handlePdfTextFocusIn(event) {
  const target = event.target.closest("[data-pdf-overlay-id], [data-pdf-text-index]");
  if (!target) return;

  setActivePdfTextBlock(target);

  syncFontSizeInputFromFocus();
}

function handlePdfTextPointerDown(event) {
  const target = event.target.closest("[data-pdf-overlay-id], [data-pdf-text-index]");
  if (!target) return;

  setActivePdfTextBlock(target);
  syncFontSizeInputFromFocus();
}

function getFocusedPdfTextBlock() {
  const item = getActiveItem();
  if (!item) return null;

  const activeElement = document.activeElement;
  const overlayId = activeElement?.dataset?.pdfOverlayId;
  if (overlayId) {
    return item.pdfTextBlocks.find(block => block.id === overlayId) || null;
  }

  const listIndex = activeElement?.dataset?.pdfTextIndex;
  if (listIndex !== undefined) {
    return item.pdfTextBlocks[Number(listIndex)] || null;
  }

  if (state.activePdfTextBlockId) {
    return item.pdfTextBlocks.find(block => block.id === state.activePdfTextBlockId) || null;
  }

  return null;
}

function syncPdfTextOverlayInput(blockId, value) {
  const field = pdfTextOverlayLayer.querySelector(`[data-pdf-overlay-id="${blockId}"]`);
  if (!field || field.value === value) return;

  field.value = value;
  const item = getActiveItem();
  const block = item?.pdfTextBlocks.find(candidate => candidate.id === blockId);
  if (block) {
    resizePdfTextOverlayInput(field, block);
    updateOverlayClasses(field, block);
  }
}

function resizePdfTextOverlayInput(input, block) {
  const minWidth = Math.max(32, block.widthRatio * previewStage.clientWidth);
  const minHeight = Math.max(18, block.heightRatio * previewStage.clientHeight);
  const maxWidth = Math.max(minWidth, previewStage.clientWidth - (block.xRatio * previewStage.clientWidth));
  const maxHeight = Math.max(minHeight, previewStage.clientHeight - (block.yRatio * previewStage.clientHeight));

  input.style.width = `${minWidth}px`;
  input.style.height = `${minHeight}px`;

  const nextWidth = clamp(Math.ceil(input.scrollWidth + 2), minWidth, maxWidth);
  input.style.width = `${nextWidth}px`;

  const nextHeight = clamp(Math.ceil(input.scrollHeight + 2), minHeight, maxHeight);
  input.style.height = `${nextHeight}px`;

  block.widthRatio = getRatio(nextWidth, previewStage.clientWidth, block.widthRatio);
  block.heightRatio = getRatio(nextHeight, previewStage.clientHeight, block.heightRatio);
}

function handlePdfOverlayInput(event) {
  const input = event.target.closest("[data-pdf-overlay-id]");
  if (!input) return;

  const item = getActiveItem();
  if (!item) return;

  const block = item.pdfTextBlocks.find(candidate => candidate.id === input.dataset.pdfOverlayId);
  if (!block) return;

  block.text = input.value;
  resizePdfTextOverlayInput(input, block);
  syncPdfTextListInput(block.id, block.text);
  updateOverlayClasses(input, block);
}

function syncPdfTextListInput(blockId, value) {
  if (!pdfTextList) return;

  const item = getActiveItem();
  if (!item) return;

  const index = item.pdfTextBlocks.findIndex(block => block.id === blockId);
  if (index < 0) return;
  const field = pdfTextList.querySelector(`[data-pdf-text-index="${index}"]`);
  if (field && field.value !== value) {
    field.value = value;
  }
}

function renderPdfTextOverlays() {
  const item = getActiveItem();
  pdfTextOverlayLayer.innerHTML = "";
  if (!item || !item.pdfTextBlocks.length) return;

  item.pdfTextBlocks.forEach(block => {
    const overlay = document.createElement("textarea");
    overlay.className = "pdf-text-overlay-item";
    overlay.dataset.pdfOverlayId = block.id;
    overlay.rows = 1;
    overlay.wrap = "off";
    overlay.spellcheck = false;
    overlay.style.left = `${block.xRatio * previewStage.clientWidth}px`;
    overlay.style.top = `${block.yRatio * previewStage.clientHeight}px`;
    overlay.style.fontSize = `${Math.max(10, block.fontSizeRatio * previewStage.clientHeight)}px`;
    overlay.value = block.text;
    resizePdfTextOverlayInput(overlay, block);
    updateOverlayClasses(overlay, block);
    pdfTextOverlayLayer.appendChild(overlay);
  });
}

function updateOverlayClasses(element, block) {
  element.classList.toggle("edited", block.text !== block.originalText);
  element.classList.toggle("annotation", block.sourceType === "annotation");
}

function handleAddInfoBox() {
  const item = getActiveItem();
  if (!item) return;

  const infoBoxes = ensureInfoBoxes(item);
  const offset = Math.min(infoBoxes.length * 0.03, 0.24);
  const next = createInfoBox({
    xRatio: Math.min(0.08 + offset, 0.72),
    yRatio: Math.min(0.08 + offset, 0.72)
  });

  infoBoxes.push(next);
  state.activePdfTextBlockId = null;
  state.activeInfoBoxId = next.id;
  setSelectedInfoBoxes([next.id], item);
  renderInfoBoxes();
  syncFontSizeInputFromFocus();
  syncInfoBoxActionButtons();

  requestAnimationFrame(() => {
    getActiveInfoBoxElement()?.focus();
  });
}

function handleCopyInfoBoxes() {
  const item = getActiveItem();
  if (!item) return;

  const selectedBoxes = getSelectedInfoBoxes(item);
  if (!selectedBoxes.length) return;

  state.copiedInfoBoxes = selectedBoxes.map(cloneInfoBoxData);
  syncInfoBoxActionButtons();
}

function handlePasteInfoBoxes() {
  const item = getActiveItem();
  if (!item || !state.copiedInfoBoxes.length) return;

  const pastedBoxes = state.copiedInfoBoxes.map(boxData => createInfoBox(boxData));
  ensureInfoBoxes(item).push(...pastedBoxes);
  state.activePdfTextBlockId = null;
  state.activeInfoBoxId = pastedBoxes[0]?.id || null;
  setSelectedInfoBoxes(pastedBoxes.map(box => box.id), item);
  renderInfoBoxes();
  syncFontSizeInputFromFocus();
  syncInfoBoxActionButtons();
}

function handleStampInput(event) {
  const item = getActiveItem();
  if (!item) return;

  const input = event.target.closest(".rich-text");
  if (!input) return;

  const stampElement = input.closest("[data-info-box-id]");
  const box = getInfoBoxById(item, stampElement?.dataset.infoBoxId);
  if (!box) return;

  box.textHtml = input.innerHTML;
}

function removeInfoBox(id) {
  const item = getActiveItem();
  if (!item) return;

  const infoBoxes = ensureInfoBoxes(item);
  const index = infoBoxes.findIndex(box => box.id === id);
  if (index < 0) return;

  infoBoxes.splice(index, 1);
  state.activeInfoBoxId = infoBoxes[Math.min(index, infoBoxes.length - 1)]?.id || null;
  setSelectedInfoBoxes(state.selectedInfoBoxIds.filter(selectedId => selectedId !== id), item);
  if (!state.selectedInfoBoxIds.length && state.activeInfoBoxId) {
    setSelectedInfoBoxes([state.activeInfoBoxId], item);
  }
  renderInfoBoxes();
  syncFontSizeInputFromFocus();
  syncInfoBoxActionButtons();
}

function handleStampFocusIn(event) {
  const item = getActiveItem();
  if (!item) return;

  const stampElement = event.target.closest("[data-info-box-id]");
  if (!stampElement) return;

  state.activePdfTextBlockId = null;
  state.activeInfoBoxId = stampElement.dataset.infoBoxId;
  if (!state.selectedInfoBoxIds.includes(state.activeInfoBoxId)) {
    setSelectedInfoBoxes([state.activeInfoBoxId], item);
    renderInfoBoxes();
  }
  syncFontSizeInputFromFocus();
  syncInfoBoxActionButtons();
}

function renderInfoBoxes() {
  const item = getActiveItem();
  stampLayer.innerHTML = "";

  if (!item || !item.showNewInfo) {
    stampLayer.classList.add("hidden");
    return;
  }

  const infoBoxes = ensureInfoBoxes(item);
  if (!infoBoxes.length) {
    stampLayer.classList.add("hidden");
    return;
  }

  stampLayer.classList.remove("hidden");

  infoBoxes.forEach(box => {
    const stampElement = document.createElement("div");
    stampElement.className = `stamp${box.id === state.activeInfoBoxId ? " active" : ""}${state.selectedInfoBoxIds.includes(box.id) ? " selected" : ""}`;
    stampElement.dataset.infoBoxId = box.id;
    stampElement.tabIndex = 0;
    stampElement.style.left = `${box.xRatio * previewStage.clientWidth}px`;
    stampElement.style.top = `${box.yRatio * previewStage.clientHeight}px`;
    stampElement.style.width = `${box.textWidth}px`;
    stampElement.style.height = `${box.textHeight}px`;
    stampElement.style.fontSize = `${box.fontSize}px`;
    stampElement.innerHTML = `
      <button type="button" class="info-box-remove" data-remove-info-box aria-label="Remover caixa de texto">x</button>
      <div class="rich-text" contenteditable="true">${box.textHtml}</div>
      <span class="resize-handle resize-handle-right" data-text-resize="right"></span>
      <span class="resize-handle resize-handle-bottom" data-text-resize="bottom"></span>
      <span class="resize-handle resize-handle-corner" data-text-resize="corner"></span>
    `;
    stampElement.addEventListener("pointerdown", handleInfoBoxPointerDown);
    stampElement.addEventListener("pointermove", handleInfoBoxPointerMove);
    stampElement.addEventListener("pointerup", endDrag);
    stampElement.addEventListener("pointercancel", endDrag);
    const richText = stampElement.querySelector(".rich-text");
    richText.style.textAlign = box.textAlign || "left";
    stampLayer.appendChild(stampElement);
  });

  syncInfoBoxActionButtons();
}

function applyTextStyle(style) {
  const item = getActiveItem();
  if (!item) return;

  const focusedPdfTextBlock = getFocusedPdfTextBlock();
  if (focusedPdfTextBlock) {
    if (style.fontSize) {
      focusedPdfTextBlock.fontSizeRatio = getRatio(style.fontSize, previewStage.clientHeight, focusedPdfTextBlock.fontSizeRatio);
      syncPdfTextOverlayInput(focusedPdfTextBlock.id, focusedPdfTextBlock.text);
      renderPdfTextOverlays();
      syncPdfTextListStyles();
      fontSizeInput.value = style.fontSize;
    }
    return;
  }

  const infoBox = getActiveInfoBox(item);
  const infoBoxElement = getActiveInfoBoxElement();
  if (!infoBox || !infoBoxElement) return;

  restoreTextSelection();
  infoBoxElement.focus();

  const selection = window.getSelection();
  const hasSelection = selection && selection.rangeCount && !selection.getRangeAt(0).collapsed && infoBoxElement.contains(selection.getRangeAt(0).commonAncestorContainer);

  if (hasSelection) {
    if (style.bold) wrapSelection(infoBoxElement, "strong");
    if (style.italic) wrapSelection(infoBoxElement, "em");
    if (style.fontSize) {
      infoBox.fontSize = style.fontSize;
      wrapSelection(infoBoxElement, "span", { fontSize: `${infoBox.fontSize}px` });
    }
  } else {
    if (style.bold) document.execCommand("bold", false, null);
    if (style.italic) document.execCommand("italic", false, null);
    if (style.fontSize) {
      infoBox.fontSize = style.fontSize;
      infoBoxElement.style.fontSize = `${infoBox.fontSize}px`;
    }
  }

  if (style.textAlign) {
    infoBox.textAlign = style.textAlign;
    infoBoxElement.style.textAlign = style.textAlign;
  }

  infoBox.textHtml = infoBoxElement.innerHTML;
  fontSizeInput.value = infoBox.fontSize;
  renderInfoBoxes();
  saveTextSelection();
}

function syncPdfTextListStyles() {
  if (!pdfTextList) return;

  const item = getActiveItem();
  if (!item) return;

  const fields = pdfTextList.querySelectorAll("[data-pdf-text-index]");
  fields.forEach(field => {
    const index = Number(field.dataset.pdfTextIndex);
    const block = item.pdfTextBlocks[index];
    if (!block) return;
    field.style.fontSize = `${Math.max(10, block.fontSizeRatio * previewStage.clientHeight)}px`;
  });
}

function normalizeFontSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size)) return 14;
  return clamp(size, 4, 60);
}

function wrapSelection(container, tagName, styles = {}) {
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed || !container.contains(range.commonAncestorContainer)) return;

  const wrapper = document.createElement(tagName);
  Object.assign(wrapper.style, styles);
  wrapper.appendChild(range.extractContents());
  range.insertNode(wrapper);

  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(wrapper);
  selection.addRange(nextRange);
  savedTextRange = nextRange.cloneRange();
}

let savedTextRange = null;

function saveTextSelection() {
  const infoBoxElement = getActiveInfoBoxElement();
  if (!infoBoxElement) return;

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!infoBoxElement.contains(range.commonAncestorContainer)) return;
  savedTextRange = range.cloneRange();
}

function restoreTextSelection() {
  if (!savedTextRange) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedTextRange);
}

function getInfoBoxBounds(box) {
  const maxLeft = Math.max(0, previewStage.clientWidth - box.textWidth);
  const maxTop = Math.max(0, previewStage.clientHeight - box.textHeight);
  return {
    maxLeft,
    maxTop
  };
}

function getResizeModeFromPointer(event, element, datasetKey) {
  const explicitMode = event.target.dataset[datasetKey];
  if (explicitMode) return explicitMode;

  const rect = element.getBoundingClientRect();
  const horizontalHitSize = 34;
  const verticalHitSize = 24;
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const nearRight = offsetX >= rect.width - horizontalHitSize;
  const nearBottom = offsetY >= rect.height - verticalHitSize;

  if (nearRight && nearBottom) return "corner";
  if (nearRight) return "right";
  if (nearBottom) return "bottom";
  return null;
}

function safeSetPointerCapture(element, pointerId) {
  if (pointerId == null || !element?.setPointerCapture) return;

  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Ignore synthetic or already-finished pointer sequences.
  }
}

function handleInfoBoxPointerDown(event) {
  const item = getActiveItem();
  if (!item) return;

  const stampElement = event.currentTarget;
  const box = getInfoBoxById(item, stampElement.dataset.infoBoxId);
  if (!box) return;

  state.activePdfTextBlockId = null;
  state.activeInfoBoxId = box.id;

  const toggleSelection = event.ctrlKey || event.metaKey;
  if (toggleSelection) {
    const nextIds = state.selectedInfoBoxIds.includes(box.id)
      ? state.selectedInfoBoxIds.filter(id => id !== box.id)
      : [...state.selectedInfoBoxIds, box.id];
    state.activeInfoBoxId = nextIds.includes(box.id) ? box.id : nextIds[0] || box.id;
    setSelectedInfoBoxes(nextIds, item);
    if (!state.selectedInfoBoxIds.length) {
      state.activeInfoBoxId = box.id;
      setSelectedInfoBoxes([box.id], item);
    }
    renderInfoBoxes();
    syncFontSizeInputFromFocus();
    event.preventDefault();
    return;
  }

  setSelectedInfoBoxes([box.id], item);
  syncFontSizeInputFromFocus();
  syncInfoBoxActionButtons();

  if (event.target.closest("[data-remove-info-box]")) {
    event.preventDefault();
    removeInfoBox(box.id);
    return;
  }

  const resizeMode = getResizeModeFromPointer(event, stampElement, "textResize");
  safeSetPointerCapture(stampElement, event.pointerId);

  if (resizeMode) {
    textResizeState = {
      pointerId: event.pointerId,
      boxId: box.id,
      mode: resizeMode,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: box.textWidth,
      startHeight: box.textHeight
    };
    event.preventDefault();
    return;
  }

  if (event.target.closest(".rich-text")) return;

  const rect = stampElement.getBoundingClientRect();
  dragState = {
    pointerId: event.pointerId,
    boxId: box.id,
    offsetX: (event.clientX - rect.left) / state.previewScale,
    offsetY: (event.clientY - rect.top) / state.previewScale
  };
}

async function handleImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const bytes = await file.arrayBuffer();
  const dataUrl = await readFileAsDataUrl(file);
  state.imageAsset = {
    bytes,
    dataUrl,
    type: file.type
  };

  await Promise.all(state.items.map(item => setInitialImageSize(dataUrl, item)));
  syncImageStamp();
  renderFileList();
  imageInput.value = "";
}

function setInitialImageSize(dataUrl, item) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const ratio = image.naturalHeight / image.naturalWidth || 1;
      item.imageWidth = 180;
      item.imageHeight = Math.max(40, Math.round(item.imageWidth * ratio));
      resolve();
    };
    image.onerror = resolve;
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function syncImageStamp() {
  const item = getActiveItem();
  if (!item || !state.imageAsset || !item.imageEnabled) {
    imageBox.classList.add("hidden");
    return;
  }

  imageStamp.src = state.imageAsset.dataUrl;
  imageStamp.style.transform = `rotate(${item.imageRotation}deg)`;
  imageBox.style.width = `${item.imageWidth}px`;
  imageBox.style.height = `${item.imageHeight}px`;
  imageBox.classList.remove("hidden");
  positionImageFromRatios();
}

function positionImageFromRatios() {
  const item = getActiveItem();
  if (!item || !state.imageAsset || !item.imageEnabled) return;

  const maxLeft = Math.max(0, previewStage.clientWidth - imageBox.offsetWidth);
  const maxTop = Math.max(0, previewStage.clientHeight - imageBox.offsetHeight);
  imageBox.style.left = `${Math.min(maxLeft, item.imageXRatio * previewStage.clientWidth)}px`;
  imageBox.style.top = `${Math.min(maxTop, item.imageYRatio * previewStage.clientHeight)}px`;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

let dragState = null;
let textResizeState = null;

function handleInfoBoxPointerMove(event) {
  if (textResizeState && event.pointerId === textResizeState.pointerId) {
    resizeTextFromPointer(event);
    return;
  }

  const item = getActiveItem();
  if (!item) return;

  const stampElement = event.currentTarget;
  const box = getInfoBoxById(item, stampElement.dataset.infoBoxId);
  if (!box || !dragState || event.pointerId !== dragState.pointerId || dragState.boxId !== box.id) return;

  const stageRect = previewStage.getBoundingClientRect();
  const bounds = getInfoBoxBounds(box);
  const left = clamp(((event.clientX - stageRect.left) / state.previewScale) - dragState.offsetX, 0, bounds.maxLeft);
  const top = clamp(((event.clientY - stageRect.top) / state.previewScale) - dragState.offsetY, 0, bounds.maxTop);

  stampElement.style.left = `${left}px`;
  stampElement.style.top = `${top}px`;
  box.xRatio = left / previewStage.clientWidth;
  box.yRatio = top / previewStage.clientHeight;
}

imageStamp.addEventListener("load", positionImageFromRatios);

let imageDragState = null;
let imageResizeState = null;
let imageRotateState = null;

imageBox.addEventListener("pointerdown", event => {
  const item = getActiveItem();
  if (!item || !state.imageAsset || !item.imageEnabled) return;

  const resizeMode = getResizeModeFromPointer(event, imageBox, "resize");
  const rotateMode = event.target.dataset.rotate;
  safeSetPointerCapture(imageBox, event.pointerId);

  if (rotateMode) {
    const rect = imageBox.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    imageRotateState = {
      pointerId: event.pointerId,
      centerX,
      centerY
    };
    rotateImageFromPointer(event);
    return;
  }

  if (resizeMode) {
    imageResizeState = {
      pointerId: event.pointerId,
      mode: resizeMode,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: item.imageWidth,
      startHeight: item.imageHeight
    };
    return;
  }

  const rect = imageBox.getBoundingClientRect();
  imageDragState = {
    pointerId: event.pointerId,
    offsetX: (event.clientX - rect.left) / state.previewScale,
    offsetY: (event.clientY - rect.top) / state.previewScale
  };
});

imageBox.addEventListener("pointermove", event => {
  if (imageRotateState && event.pointerId === imageRotateState.pointerId) {
    rotateImageFromPointer(event);
    return;
  }

  if (imageResizeState && event.pointerId === imageResizeState.pointerId) {
    resizeImageFromPointer(event);
    return;
  }

  if (!imageDragState || event.pointerId !== imageDragState.pointerId) return;

  const item = getActiveItem();
  if (!item) return;

  const stageRect = previewStage.getBoundingClientRect();
  const maxLeft = Math.max(0, previewStage.clientWidth - imageBox.offsetWidth);
  const maxTop = Math.max(0, previewStage.clientHeight - imageBox.offsetHeight);
  const left = clamp(((event.clientX - stageRect.left) / state.previewScale) - imageDragState.offsetX, 0, maxLeft);
  const top = clamp(((event.clientY - stageRect.top) / state.previewScale) - imageDragState.offsetY, 0, maxTop);

  imageBox.style.left = `${left}px`;
  imageBox.style.top = `${top}px`;
  item.imageXRatio = left / previewStage.clientWidth;
  item.imageYRatio = top / previewStage.clientHeight;
});

imageBox.addEventListener("pointerup", endImageInteraction);
imageBox.addEventListener("pointercancel", endImageInteraction);

function endDrag(event) {
  if (dragState && event.pointerId === dragState.pointerId) {
    dragState = null;
  }

  if (textResizeState && event.pointerId === textResizeState.pointerId) {
    textResizeState = null;
  }
}

function resizeTextFromPointer(event) {
  const item = getActiveItem();
  if (!item || !textResizeState) return;

  const box = getInfoBoxById(item, textResizeState.boxId);
  if (!box) return;

  const dx = (event.clientX - textResizeState.startX) / state.previewScale;
  const dy = (event.clientY - textResizeState.startY) / state.previewScale;
  const maxWidth = Math.max(120, previewStage.clientWidth - (box.xRatio * previewStage.clientWidth));
  const maxHeight = Math.max(60, previewStage.clientHeight - (box.yRatio * previewStage.clientHeight));

  if (textResizeState.mode === "right") {
    box.textWidth = clamp(textResizeState.startWidth + dx, 120, maxWidth);
  }

  if (textResizeState.mode === "bottom") {
    box.textHeight = clamp(textResizeState.startHeight + dy, 60, maxHeight);
  }

  if (textResizeState.mode === "corner") {
    box.textWidth = clamp(textResizeState.startWidth + dx, 120, maxWidth);
    box.textHeight = clamp(textResizeState.startHeight + dy, 60, maxHeight);
  }

  renderInfoBoxes();
}

function resizeImageFromPointer(event) {
  const item = getActiveItem();
  if (!item || !imageResizeState) return;

  const dx = (event.clientX - imageResizeState.startX) / state.previewScale;
  const dy = (event.clientY - imageResizeState.startY) / state.previewScale;
  const maxWidth = Math.max(40, previewStage.clientWidth - (item.imageXRatio * previewStage.clientWidth));
  const maxHeight = Math.max(40, previewStage.clientHeight - (item.imageYRatio * previewStage.clientHeight));

  if (imageResizeState.mode === "right") {
    item.imageWidth = clamp(imageResizeState.startWidth + dx, 40, maxWidth);
  }

  if (imageResizeState.mode === "bottom") {
    item.imageHeight = clamp(imageResizeState.startHeight + dy, 40, maxHeight);
  }

  if (imageResizeState.mode === "corner") {
    item.imageWidth = clamp(imageResizeState.startWidth + dx, 40, maxWidth);
    item.imageHeight = clamp(imageResizeState.startHeight + dy, 40, maxHeight);
  }

  imageBox.style.width = `${item.imageWidth}px`;
  imageBox.style.height = `${item.imageHeight}px`;
}

function rotateImageFromPointer(event) {
  const item = getActiveItem();
  if (!item || !imageRotateState) return;

  const dx = event.clientX - imageRotateState.centerX;
  const dy = event.clientY - imageRotateState.centerY;
  item.imageRotation = normalizeDegrees(Math.atan2(dy, dx) * 180 / Math.PI + 90);
  imageStamp.style.transform = `rotate(${item.imageRotation}deg)`;
}

function endImageInteraction(event) {
  if (imageDragState && event.pointerId === imageDragState.pointerId) {
    imageDragState = null;
  }

  if (imageResizeState && event.pointerId === imageResizeState.pointerId) {
    imageResizeState = null;
  }

  if (imageRotateState && event.pointerId === imageRotateState.pointerId) {
    imageRotateState = null;
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

async function generateMergedPdf() {
  if (!state.items.length) return;

  generateBtn.disabled = true;
  generateBtn.textContent = "Gerando...";

  try {
    const output = await PDFDocument.create();
    const fonts = {
      regular: await output.embedFont(StandardFonts.Helvetica),
      bold: await output.embedFont(StandardFonts.HelveticaBold),
      italic: await output.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await output.embedFont(StandardFonts.HelveticaBoldOblique)
    };
    const embeddedImage = await embedSelectedImage(output);
    const sourceCache = new Map();

    for (const item of state.items) {
      let source = sourceCache.get(item.sourceId);
      if (!source) {
        source = await PDFDocument.load(item.bytes);
        sourceCache.set(item.sourceId, source);
      }

      const [copiedPage] = await output.copyPages(source, [item.pageIndex]);
      const addedPage = output.addPage(copiedPage);
      applyPreviewRotation(addedPage, item);
      drawEditedPdfText(addedPage, fonts, item);
      drawClientInfo(addedPage, fonts, item);
      drawSelectedImage(addedPage, embeddedImage, item);
    }

    const bytes = await output.save();
    downloadBlob(bytes, "plantas-com-dados.pdf", "application/pdf");
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Gerar PDF final";
  }
}

function drawClientInfo(page, fonts, item) {
  if (!item.showNewInfo) return;

  const { width, height } = getVisiblePageSize(page);
  ensureInfoBoxes(item).forEach(box => {
    const sourceLines = getRichTextLinesFromHtml(box.textHtml, box.fontSize);
    if (!sourceLines.length) return;

    const pdfBaseFontSize = getPdfFontSize(box.fontSize, height);
    const scaledLines = scaleRichTextLinesForPdf(sourceLines, height, box.fontSize);
    const xFromLeft = Math.max(8, box.xRatio * width);
    const yFromTop = Math.max(8, box.yRatio * height);
    const maxWidth = getPdfTextWidth(box.textWidth, width);
    const wrappedLines = wrapRichLines(scaledLines, fonts, maxWidth, pdfBaseFontSize);
    let yOffset = 0;

    wrappedLines.forEach(line => {
      const lineSize = Math.max(...line.map(segment => segment.size || pdfBaseFontSize), 4);
      const lineGap = lineSize * 1.35;
      const lineWidth = line.reduce((total, segment) => {
        const font = getSegmentFont(segment, fonts);
        const segmentSize = segment.size || pdfBaseFontSize;
        return total + font.widthOfTextAtSize(segment.text, segmentSize);
      }, 0);
      const textAlign = box.textAlign || "left";
      const remainingWidth = Math.max(0, maxWidth - lineWidth);
      let cursorX = xFromLeft;

      if (textAlign === "center") {
        cursorX += remainingWidth / 2;
      } else if (textAlign === "right") {
        cursorX += remainingWidth;
      }

      line.forEach(segment => {
        const font = getSegmentFont(segment, fonts);
        const segmentSize = segment.size || pdfBaseFontSize;
        const placement = getTextPlacement(page, cursorX, yFromTop + yOffset, segmentSize);
        page.drawText(segment.text, {
          x: placement.x,
          y: placement.y,
          size: segmentSize,
          font,
          color: rgb(0.06, 0.09, 0.16),
          rotate: placement.rotate
        });
        cursorX += font.widthOfTextAtSize(segment.text, segmentSize);
      });
      yOffset += lineGap;
    });
  });
}

function getPreviewToPdfScale(pageVisibleHeight) {
  if (!previewStage.clientHeight) return 1;
  return pageVisibleHeight / previewStage.clientHeight;
}

function getPdfFontSize(previewFontSize, pageVisibleHeight) {
  return Math.max(4, previewFontSize * getPreviewToPdfScale(pageVisibleHeight));
}

function scaleRichTextLinesForPdf(lines, pageVisibleHeight, fallbackFontSize) {
  return lines.map(line => line.map(segment => ({
    ...segment,
    size: getPdfFontSize(segment.size || fallbackFontSize, pageVisibleHeight)
  })));
}

function drawEditedPdfText(page, fonts, item) {
  const editedBlocks = (item.pdfTextBlocks || []).filter(block => block.text !== block.originalText);
  if (!editedBlocks.length) return;

  const { width, height } = getVisiblePageSize(page);

  editedBlocks.forEach(block => {
    const xFromLeft = Math.max(0, block.xRatio * width);
    const yFromTop = Math.max(0, block.yRatio * height);
    const boxWidth = Math.max(24, block.widthRatio * width);
    const boxHeight = Math.max(14, block.heightRatio * height);
    const coverWidth = Math.max(24, (block.originalWidthRatio || block.widthRatio) * width);
    const coverHeight = Math.max(14, (block.originalHeightRatio || block.heightRatio) * height);
    const fontSize = Math.max(6, block.fontSizeRatio * height);
    const rectPlacement = getRectPlacement(page, xFromLeft, yFromTop, coverWidth, coverHeight);
    const font = getPdfTextFont(block, fonts, width, height);

    page.drawRectangle({
      x: rectPlacement.x,
      y: rectPlacement.y,
      width: rectPlacement.width,
      height: rectPlacement.height,
      color: rgb(1, 1, 1),
      rotate: degrees(rectPlacement.rotateAngle)
    });

    if (!block.text.trim()) return;

    const lines = splitPlainTextLines(block.text);
    let yOffset = 2;

    lines.forEach(line => {
      const placement = getTextPlacement(page, xFromLeft + 2, yFromTop + yOffset, fontSize);
      page.drawText(line, {
        x: placement.x,
        y: placement.y,
        size: fontSize,
        font,
        color: rgb(0.06, 0.09, 0.16),
        rotate: placement.rotate
      });
      yOffset += fontSize * 1.2;
    });
  });
}

function splitPlainTextLines(text) {
  const normalized = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  return lines.length ? lines : [""];
}

function getRectPlacement(page, xFromLeft, yFromTop, boxWidth, boxHeight) {
  const { width, height } = page.getSize();
  const angle = getRotationAngle(page);

  if (angle === 90) {
    return {
      x: yFromTop,
      y: height - xFromLeft - boxWidth,
      width: boxHeight,
      height: boxWidth,
      rotateAngle: 270
    };
  }

  if (angle === 180) {
    return {
      x: width - xFromLeft - boxWidth,
      y: yFromTop,
      width: boxWidth,
      height: boxHeight,
      rotateAngle: 180
    };
  }

  if (angle === 270) {
    return {
      x: width - yFromTop - boxHeight,
      y: xFromLeft,
      width: boxHeight,
      height: boxWidth,
      rotateAngle: 90
    };
  }

  return {
    x: xFromLeft,
    y: height - yFromTop - boxHeight,
    width: boxWidth,
    height: boxHeight,
    rotateAngle: 0
  };
}

function getPdfTextWidth(textWidth, pageVisibleWidth) {
  if (!previewStage.clientWidth) return pageVisibleWidth * 0.28;
  return Math.max(40, (textWidth / previewStage.clientWidth) * pageVisibleWidth);
}

function getRichTextLinesFromHtml(html, baseFontSize) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  const lines = [[]];

  template.content.childNodes.forEach(child => {
    collectRichSegments(child, { bold: false, italic: false, size: baseFontSize }, lines);
  });

  const normalized = lines.map(line => line.filter(segment => segment.text));
  return normalized.some(line => line.length) ? normalized : [];
}

function collectRichSegments(node, inherited, lines) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parts = node.textContent.replace(/\u00a0/g, " ").split(/\r?\n/);
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ ...inherited, text: part });
    });
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const tag = node.tagName.toLowerCase();
  const inlineSize = parseFloat(node.style.fontSize);
  const next = {
    bold: inherited.bold || tag === "b" || tag === "strong",
    italic: inherited.italic || tag === "i" || tag === "em",
    size: Number.isFinite(inlineSize) ? inlineSize : inherited.size
  };

  if (tag === "br") {
    lines.push([]);
    return;
  }

  const isBlock = ["div", "p"].includes(tag);
  const startsBlock = isBlock && lines[lines.length - 1].length > 0;
  if (startsBlock) lines.push([]);
  node.childNodes.forEach(child => collectRichSegments(child, next, lines));
  if (isBlock && lines[lines.length - 1].length > 0) {
    lines.push([]);
  }
}

function wrapRichLines(lines, fonts, maxWidth, baseFontSize) {
  const output = [];
  lines.forEach(line => {
    let current = [];
    let width = 0;
    line.forEach(segment => {
      const tokens = segment.text.split(/(\s+)/).filter(Boolean);
      tokens.forEach(token => {
        const font = getSegmentFont(segment, fonts);
        const tokenWidth = font.widthOfTextAtSize(token, segment.size || baseFontSize);
        if (width + tokenWidth > maxWidth && current.length) {
          output.push(current);
          current = [];
          width = 0;
        }
        current.push({ ...segment, text: token });
        width += tokenWidth;
      });
    });
    output.push(current.length ? current : [{ text: "", size: baseFontSize, bold: false, italic: false }]);
  });
  return output;
}

function getSegmentFont(segment, fonts) {
  if (segment.bold && segment.italic) return fonts.boldItalic;
  if (segment.bold) return fonts.bold;
  if (segment.italic) return fonts.italic;
  return fonts.regular;
}

function getTextPlacement(page, xFromLeft, yFromTop, fontSize) {
  const { width, height } = page.getSize();
  const angle = getRotationAngle(page);
  const safe = 8;

  if (angle === 90) {
    return {
      x: clamp(yFromTop, safe, width - safe),
      y: clamp(height - xFromLeft, safe, height - safe),
      rotate: degrees(270)
    };
  }

  if (angle === 180) {
    return {
      x: clamp(width - xFromLeft, safe, width - safe),
      y: clamp(yFromTop, safe, height - safe),
      rotate: degrees(180)
    };
  }

  if (angle === 270) {
    return {
      x: clamp(width - yFromTop, safe, width - safe),
      y: clamp(xFromLeft, safe, height - safe),
      rotate: degrees(90)
    };
  }

  return {
    x: clamp(xFromLeft, safe, width - safe),
    y: clamp(height - yFromTop - fontSize, safe, height - safe),
    rotate: degrees(0)
  };
}

async function embedSelectedImage(output) {
  if (!state.imageAsset) return null;

  if (state.imageAsset.type === "image/png") {
    return output.embedPng(state.imageAsset.bytes);
  }

  return output.embedJpg(state.imageAsset.bytes);
}

function drawSelectedImage(page, embeddedImage, item) {
  if (!embeddedImage || !item.imageEnabled) return;

  const { width, height } = getVisiblePageSize(page);
  const imageSize = getPdfImageSize(item.imageWidth, item.imageHeight, width, height);
  const imageWidth = imageSize.width;
  const imageHeight = imageSize.height;
  const xFromLeft = Math.max(8, item.imageXRatio * width);
  const yFromTop = Math.max(8, item.imageYRatio * height);
  const placement = getImagePlacement(page, xFromLeft, yFromTop, imageWidth, imageHeight);
  const rotation = normalizeDegrees(placement.rotateAngle - item.imageRotation);
  const drawOrigin = getCenteredImageDrawOrigin(placement, imageWidth, imageHeight, placement.rotateAngle, rotation);

  page.drawImage(embeddedImage, {
    x: drawOrigin.x,
    y: drawOrigin.y,
    width: imageWidth,
    height: imageHeight,
    rotate: degrees(rotation)
  });
}

function getCenteredImageDrawOrigin(placement, imageWidth, imageHeight, baseRotation, finalRotation) {
  if (baseRotation === finalRotation) {
    return { x: placement.x, y: placement.y };
  }

  const center = getRotatedImageCenter(placement.x, placement.y, imageWidth, imageHeight, baseRotation);
  const offset = getRotatedVector(imageWidth / 2, imageHeight / 2, finalRotation);

  return {
    x: center.x - offset.x,
    y: center.y - offset.y
  };
}

function getRotatedImageCenter(x, y, imageWidth, imageHeight, rotation) {
  const offset = getRotatedVector(imageWidth / 2, imageHeight / 2, rotation);
  return {
    x: x + offset.x,
    y: y + offset.y
  };
}

function getRotatedVector(x, y, rotation) {
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: (x * cos) - (y * sin),
    y: (x * sin) + (y * cos)
  };
}

function getPdfImageSize(imageWidth, imageHeight, pageVisibleWidth, pageVisibleHeight) {
  if (!previewStage.clientWidth || !previewStage.clientHeight) {
    return {
      width: pageVisibleWidth * 0.16,
      height: pageVisibleHeight * 0.16
    };
  }

  return {
    width: Math.max(20, (imageWidth / previewStage.clientWidth) * pageVisibleWidth),
    height: Math.max(20, (imageHeight / previewStage.clientHeight) * pageVisibleHeight)
  };
}

function getImagePlacement(page, xFromLeft, yFromTop, imageWidth, imageHeight) {
  const { width, height } = page.getSize();
  const angle = getRotationAngle(page);
  const safe = 8;
  const rotatedWidth = angle % 180 === 0 ? imageWidth : imageHeight;
  const rotatedHeight = angle % 180 === 0 ? imageHeight : imageWidth;
  const maxX = Math.max(safe, width - rotatedWidth - safe);
  const maxY = Math.max(safe, height - rotatedHeight - safe);

  if (angle === 90) {
    return {
      x: clamp(yFromTop, safe, maxX),
      y: clamp(height - xFromLeft - imageWidth, safe, maxY),
      rotateAngle: 270
    };
  }

  if (angle === 180) {
    return {
      x: clamp(width - xFromLeft - imageWidth, safe, maxX),
      y: clamp(yFromTop, safe, maxY),
      rotateAngle: 180
    };
  }

  if (angle === 270) {
    return {
      x: clamp(width - yFromTop - imageHeight, safe, maxX),
      y: clamp(xFromLeft, safe, maxY),
      rotateAngle: 90
    };
  }

  return {
    x: clamp(xFromLeft, safe, maxX),
    y: clamp(height - yFromTop - imageHeight, safe, maxY),
    rotateAngle: 0
  };
}

function applyPreviewRotation(page, item) {
  const autoRotation = item.autoPreviewRotation ?? (() => {
    const visibleSize = getVisiblePageSize(page);
    return visibleSize.height > visibleSize.width ? 90 : 0;
  })();
  const angle = normalizeDegrees(getRotationAngle(page) + autoRotation + item.previewRotation);
  page.setRotation(degrees(angle));
}

function getVisiblePageSize(page) {
  const { width, height } = page.getSize();
  const angle = getRotationAngle(page);

  if (angle % 180 !== 0) {
    return { width: height, height: width };
  }

  return { width, height };
}

function getRotationAngle(page) {
  return ((page.getRotation().angle % 360) + 360) % 360;
}

let draggedPdfId = null;

function handlePdfDragStart(event) {
  if (event.target.closest(".image-target")) {
    event.preventDefault();
    return;
  }

  draggedPdfId = event.currentTarget.dataset.id;
  event.currentTarget.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
}

function handlePdfDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

async function handlePdfDrop(event) {
  event.preventDefault();
  const targetId = event.currentTarget.dataset.id;
  if (!draggedPdfId || draggedPdfId === targetId) return;

  const fromIndex = state.items.findIndex(item => item.id === draggedPdfId);
  const toIndex = state.items.findIndex(item => item.id === targetId);
  if (fromIndex < 0 || toIndex < 0) return;

  const [moved] = state.items.splice(fromIndex, 1);
  state.items.splice(toIndex, 0, moved);
  await showItem(state.activeId);
}

function handlePdfDragEnd(event) {
  event.currentTarget.classList.remove("dragging");
  draggedPdfId = null;
}

function downloadBlob(bytes, fileName, type) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
