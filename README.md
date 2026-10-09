# ✅ TaskUp — organizador pessoal gamificado e 100% offline

Aplicativo de tarefas, lembretes e rotina feito com **HTML, CSS e JavaScript puro**.
Sem frameworks, sem servidor, sem contas: todos os dados ficam salvos **somente no seu dispositivo** (`localStorage`).

## Como usar

- **Mais simples:** dê dois cliques em `index.html` — funciona direto no navegador.
- **Experiência completa (PWA instalável + cache offline via Service Worker):** sirva a pasta localmente, por exemplo:
  ```bash
  python3 -m http.server 8080
  # abra http://localhost:8080
  ```
  Depois use "Instalar app" no menu lateral (ou no menu do navegador). Após o primeiro acesso, ele abre mesmo sem internet.

> Service Workers e a instalação como app só funcionam em `http://localhost` ou `https://` — abrindo como arquivo (`file://`) todo o resto funciona normalmente.

## Funcionalidades

| Área | O que tem |
|---|---|
| 🏠 **Painel** | Saudação conforme o horário (Bom dia/Boa tarde/Boa noite), mensagem motivacional, mascote, cards de tarefas de hoje / concluídas / atrasadas / alta prioridade / sequência / XP do dia, anel e barra de progresso ("3 de 7 tarefas concluídas"), próximas tarefas, adição rápida, missões, gráfico dos últimos 7 dias e progresso por categoria |
| 🕒 **Minha Rotina** | Linha do tempo do dia com marcador de "agora", atividade em andamento destacada, intervalos livres clicáveis, alterar horário clicando na hora, concluir, iniciar Pomodoro, tarefas sem horário, navegação entre dias e modelos rápidos (Estudar, Almoço, Exercício… — Shift+clique para repetir todo dia) |
| ✅ **Tarefas** | Criar/editar/excluir (com desfazer), emoji, prioridade, categoria, data, horário, duração, lembrete, repetição (diária, dias úteis, semanal, mensal, anual), subtarefas e notas. Filtros por status, categoria, prioridade, busca e ordenação. Adição rápida em linguagem natural: `Pagar conta amanhã 10h #financeiro !alta` |
| 📅 **Calendário** | Visão mensal com pontos coloridos por categoria, dias com atraso / tudo concluído, painel do dia selecionado |
| 🍅 **Pomodoro** | Foco, pausa curta e pausa longa configuráveis, anel animado, vínculo com tarefa (conta 🍅 por tarefa), ciclo até a pausa longa, início automático opcional, continua contando mesmo recarregando a página, mini-timer no topo |
| 🗂️ **Categorias** | Trabalho, Escola, Faculdade, Pessoal, Compras, Financeiro, Saúde, Compromissos, Projetos e Outros já criadas; crie, edite (nome, emoji, cor), reordene e exclua (movendo ou apagando as tarefas) |
| 🏆 **Gamificação** | XP e níveis com títulos, sequência de dias 🔥, 20 conquistas, 3 missões diárias, desafio semanal, moedas, loja de cores de tema e mascotes, confetes e sons. **Tudo pode ser desativado** em Configurações |
| 🔔 **Notificações** | Lembretes por tarefa (na hora, 5 min… 1 dia antes), aviso no horário, resumo diário, badge no ícone do app (quando suportado) |
| 💾 **Dados** | Exportar/importar backup JSON, exportar planilha CSV, cópias automáticas diárias no próprio navegador, apagar tudo |
| ⚙️ **Configurações** | Nome, tema claro/escuro/automático, cor de destaque, interruptores de cada recurso de gamificação, sons e volume, notificações, durações do Pomodoro |

**Atalhos de teclado:** `N` nova tarefa · `/` buscar · `1`–`8` navegar · `P` iniciar/pausar Pomodoro · `Esc` fechar.

## Sobre as notificações

Como não há servidor, os lembretes são disparados pelo próprio app enquanto ele estiver aberto (inclusive minimizado ou em outra aba).
Instalado como app, a experiência fica mais próxima de um app nativo. Em navegadores com suporte a *Notification Triggers*, os lembretes das próximas 24h também são agendados no sistema.

## Estrutura

```
index.html            # casca da aplicação
manifest.json         # PWA
service-worker.js     # cache offline
css/style.css         # todo o visual (tokens, claro/escuro, responsivo, animações)
js/utils.js           # datas, helpers, barramento de eventos
js/storage.js         # estado + persistência em localStorage
js/ui.js              # toasts, modais, confete, sons (Web Audio API)
js/gamification.js    # XP, níveis, conquistas, missões, loja
js/tasks.js           # tarefas, formulário, adição rápida, tela Tarefas
js/routine.js         # Minha Rotina (linha do tempo)
js/calendar.js        # calendário mensal
js/pomodoro.js        # timer Pomodoro
js/notifications.js   # lembretes e notificações
js/backup.js          # exportar/importar/cópias automáticas
js/categories.js      # gerenciamento de categorias
js/settings.js        # tela de configurações
js/dashboard.js       # painel inicial
js/app.js             # inicialização, navegação, tema, atalhos
assets/icons/         # ícones do app
assets/sounds/        # (sons são sintetizados — veja o README da pasta)
```

Os scripts são carregados como scripts clássicos (não módulos ES) de propósito, para que o app funcione ao abrir o `index.html` direto do disco.
Ao alterar arquivos, troque `CACHE_VERSION` em `service-worker.js` para que o app instalado receba a atualização.

## Versão em arquivo único

Para gerar um único `TaskUp.html` com tudo embutido (fácil de enviar ou abrir em qualquer lugar):

```bash
python3 tools/build-single.py   # gera dist/TaskUp.html
```
