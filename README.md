# Plantas - MVP

MVP simples para inserir nome completo e endereco em plantas baixas em PDF e gerar um unico PDF final, com edicao independente por pagina.

## Como usar

1. Abra `index.html` no navegador.
2. Selecione um ou mais PDFs de planta baixa. Cada PDF multipagina sera expandido na lista lateral, uma pagina por item.
3. Arraste as paginas na lista lateral para definir a ordem do PDF final.
4. Clique em uma pagina da lista lateral para visualiza-la na previa.
5. Edite a caixa de texto diretamente na pagina atual e use `Novas informacoes` para exibir ou ocultar esse bloco adicional.
6. Selecione parte do texto para mudar tamanho, negrito ou italico.
7. Arraste a caixa de texto pela borda e puxe as alcas para redimensionar.
8. Edite os campos em `Textos detectados no PDF` ou clique diretamente sobre os textos na propria previa do PDF para substituir o conteudo original, inclusive em anotacoes visiveis.
9. Se precisar, faca upload de uma imagem opcional, arraste a imagem na previa, puxe pelas alcas para redimensionar e use a alca circular acima da imagem para girar com o mouse.
10. Na lista lateral, marque `Imagem` apenas nas paginas que devem receber essa imagem.
11. Clique em `Gerar PDF final`.

## Observacoes

- O processamento acontece no navegador.
- Cada pagina possui seu proprio texto, posicao, tamanho, rotacao e uso da imagem.
- Os textos detectados do PDF podem ser substituidos por novos valores na pagina atual, inclusive em anotacoes visiveis detectadas pelo `pdf.js`.
- A imagem opcional e aplicada somente nas paginas marcadas na lista lateral.
- PDFs em A3, A4 ou outros formatos sao exibidos e gerados em paisagem quando a pagina estiver em retrato.
- A pagina usa `pdf-lib` e `pdf.js` via CDN.
- Para usar sem internet, baixe essas bibliotecas e ajuste os scripts no `index.html`.

## Site publicado

Use a versao online em https://plantaspdf.netlify.app/.
