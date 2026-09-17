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
3. aplica sua escolha para **Impressora Saipos Printer**;
4. aplica as preferências de venda e cupom fiscal dos módulos disponíveis;
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

A extensão identifica a página de login `#/access/login`. Ao chegar em uma das telas abaixo, aguarda 4 segundos e aplica suas preferências uma vez naquela sessão:

- Kanban: `#/app/sale/delivery/kanban/search-customer`
- Atendimento por Ficha: `#/app/sale/service-ticket/main`
- Mesas: `#/app/sale/table-order/new-main`

Se a tela ainda estiver carregando, tenta novamente após 5 segundos. Para aplicar manualmente, clique no ícone da extensão e em **Salvar e aplicar agora**.

### Preferências por campo

Abra o ícone da extensão para escolher separadamente o comportamento de **Venda** e **Cupom fiscal** em Delivery, Fichas e Mesas: **Sempre Imprimir**, **Nunca imprimir**, **Sempre Perguntar** ou **Não alterar**.

Para a impressora, escolha **Imprimir neste Computador**, **Não Imprimir Neste Computador**, **Perguntar ao Iniciar** ou **Não alterar**.

Exemplo: escolha **Sempre Imprimir** nos dois campos de Fichas e **Nunca imprimir** nos dois campos de Mesas; depois clique em **Salvar preferências**. As escolhas ficam gravadas neste navegador/computador e valem para todas as contas Saipos usadas nele, inclusive após fechar e reabrir o navegador. Não há sincronização entre computadores nem perfil separado por loja. Remover a extensão apaga essas preferências.

Salvar novas preferências também agenda a aplicação nas abas abertas em uma das três telas atendidas. A execução continua aguardando qualquer outra janela da Saipos ser concluída. Se todos os campos estiverem em **Não alterar**, a extensão não abre a janela nem salva nada.

Sem personalização, o padrão permanece **Imprimir neste Computador** e **Sempre Imprimir** nas confirmações.

Os campos são tratados individualmente. Se uma loja não possuir Delivery, Atendimento por Fichas ou Atendimento de Mesa, a extensão configura apenas as opções disponíveis na janela e salva normalmente. Se um campo presente não aceitar a escolha solicitada, a execução informa a falha e não clica em Salvar.

Se outra janela da Saipos estiver aberta, como **Opções de frente de caixa**, a extensão não executa nenhuma ação. Ela aguarda essa janela ser concluída e tenta novamente após 5 segundos.

Depois de substituir ou atualizar os arquivos da extensão, abra a página de extensões do navegador e clique no botão **Recarregar**. Atualize também as abas abertas da Saipos. A versão 1.4.0 adiciona a permissão de armazenamento para guardar as preferências.

Ela só atua em páginas HTTPS do domínio `saipos.com` e não lê nem armazena usuário ou senha.

O ícone da extensão utiliza o logotipo UP Tecnologias com fundo transparente.

## Autoria

Desenvolvido por [math7x](https://github.com/math7x).
