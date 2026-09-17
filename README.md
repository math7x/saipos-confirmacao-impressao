# Saipos - Confirmação de Impressão

Extensão para Google Chrome, Brave e Microsoft Edge que configura automaticamente as confirmações de impressão da Saipos neste computador.

## Problema que resolve

Cada estação precisa ter várias opções de impressão configuradas corretamente. Repetir esse ajuste manualmente após o login, uma reinstalação ou a preparação de um novo computador consome tempo e pode deixar alguma confirmação com o comportamento errado.

## Solução desenvolvida

A extensão abre a configuração necessária, seleciona **Imprimir neste Computador** e aplica **Sempre Imprimir** às opções disponíveis. Ela valida cada etapa, ignora módulos que a loja não utiliza e permite repetir o processo manualmente pelo ícone. Assim, a preparação da estação fica padronizada e menos sujeita a esquecimentos.

## Visão técnica

Automatiza um fluxo repetitivo de configuração por meio de scripts de conteúdo, com verificação de cada etapa e interface para acompanhar o resultado. A execução fica restrita aos domínios da Saipos.

Tecnologias principais: JavaScript, HTML, CSS e Chrome Extensions API.

## Fluxo automatizado

1. abre o menu do perfil;
2. entra em **Confirmações de Impressão**;
3. seleciona **Imprimir neste Computador**;
4. seleciona **Sempre Imprimir** em todas as seis confirmações;
5. clica em **SALVAR**.

## Instalação no Google Chrome

1. Abra `chrome://extensions`.
2. Ative **Modo do desenvolvedor** no canto superior direito.
3. Clique em **Carregar sem compactação**.
4. Selecione esta pasta: `EXTENSÃO CONFIRMA IMPRESSÃO SAIPOS`.
5. Acesse ou atualize `https://conta.saipos.com/` e faça login.

## Instalação no Microsoft Edge

1. Abra `edge://extensions`.
2. Ative **Modo de desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione esta pasta.

## Uso

A extensão identifica a página de login `#/access/login`. Quando a Saipos redireciona para o Kanban em `#/app/sale/delivery/kanban/search-customer` ou para o Atendimento por Ficha em `#/app/sale/service-ticket/main`, ela aguarda 4 segundos e aplica a configuração automaticamente uma vez naquela sessão. Se a tela ainda estiver carregando, tenta novamente após 5 segundos. Para repetir manualmente, clique no ícone da extensão e em **Aplicar agora**.

Os campos são tratados individualmente. Se uma loja não possuir Delivery, Atendimento por Fichas ou Atendimento de Mesa, a extensão configura apenas as opções disponíveis na janela e salva normalmente.

Se outra janela da Saipos estiver aberta, como **Opções de frente de caixa**, a extensão não executa nenhuma ação. Ela aguarda essa janela ser concluída e tenta novamente após 5 segundos.

Depois de substituir ou atualizar os arquivos da extensão, abra a página de extensões do navegador e clique no botão **Recarregar** da extensão antes de testar novamente.

Ela só atua em páginas HTTPS do domínio `saipos.com` e não lê nem armazena usuário ou senha.

O ícone da extensão utiliza o logotipo UP Tecnologias com fundo transparente.

## Autoria

Desenvolvido por [math7x](https://github.com/math7x).
