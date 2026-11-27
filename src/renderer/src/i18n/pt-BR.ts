/**
 * Todo texto visível da interface, em português do Brasil.
 *
 * Traduzir o app é acrescentar um arquivo com esta mesma forma (`Translation`,
 * em `index.ts`) e registrá-lo lá. Convenções:
 *
 * - `{nome}` é uma variável, preenchida por quem chama `t`;
 * - `<b>…</b>` e `<code>…</code>` só valem nas chaves lidas com `tRich`;
 * - um par `one` / `other` é um plural, lido com `tPlural`.
 *
 * Os resumos de `help.rules` seguem `docs/regras-de-negocio/`: mudou a regra,
 * revise o resumo aqui.
 */
export const ptBR = {
  common: {
    id: 'ID',
    title: 'Título',
    status: 'Status',
    name: 'Nome',
    product: 'Produto',
    products: 'Produtos',
    project: 'Projeto',
    organization: 'Organização',
    groups: 'Grupos',
    squads: 'Squads',
    processProfiles: 'Perfis de processo',
    sprint: 'Sprint',
    month: 'Mês',
    total: 'Total',
    all: 'Todos',
    unassigned: 'Sem responsável',
    loadFailed: 'Falha ao carregar os dados',
    itemCount: { one: '{count} item', other: '{count} itens' }
  },

  actions: {
    back: 'Voltar',
    next: 'Próximo',
    add: 'Adicionar',
    cancel: 'Cancelar',
    save: 'Salvar',
    retry: 'Tentar de novo',
    backToStart: 'Voltar ao início'
  },

  refresh: {
    button: 'Atualizar',
    buttonBusy: 'Atualizando…',
    fetching: 'Buscando no Azure…',
    updatedAt: 'Atualizado às',
    hint: 'Busca de novo no Azure o que esta tela mostra (F5)'
  },

  disciplines: {
    frontend: 'Frontend',
    backend: 'Backend',
    qa: 'QA',
    front: 'Front',
    back: 'Back'
  },

  nav: {
    sections: 'Seções',
    collapse: 'Recolher menu',
    expand: 'Expandir menu',
    home: 'Home',
    planning: 'Planning',
    daily: 'Daily',
    review: 'Review',
    settings: 'Configuração',
    security: 'Segurança',
    sprintDelivery: 'Entregas da Sprint',
    bugAnalysis: 'Análise de Bugs',
    releaseNotes: 'Novidades',
    connectAi: 'Conectar à sua IA',
    features: 'Features',
    catalog: 'Catálogo',
    opportunities: 'Oportunidades',
    followUp: 'Acompanhamento',
    flow: 'Fluxo do PO'
  },

  squads: {
    tabsLabel: 'Squads',
    tabLabel: 'Squad {name}',
    whole: 'Squad inteira',
    productCount: { one: '{count} produto', other: '{count} produtos' },
    create: 'Criar Squad na Configuração'
  },

  userMenu: {
    open: 'Conta e token',
    changeToken: 'Trocar token',
    exploreDemo: 'Explorar com dados de exemplo',
    hello: 'Olá',
    helloName: 'Olá, {name}'
  },

  home: {
    version: 'v{version}',
    greeting: {
      morning: 'Bom dia',
      afternoon: 'Boa tarde',
      evening: 'Boa noite'
    },
    greetingName: '{greeting}, {name}',
    sprintDay: '{sprint} · dia {day} de {total}',
    sprintBefore: '{sprint} · ainda não começou',
    sprintEnded: '{sprint} · já terminou',
    noSprint: 'Nenhuma sprint encontrada nos Produtos da Configuração',
    suggestion: {
      label: 'Sugestão para agora',
      planningTitle: 'Começo de sprint: hora do Planning',
      planningText: 'Confira se o escopo cabe na capacidade do time antes de fechar a sprint.',
      planningAction: 'Abrir Planning',
      dailyTitle: 'Meio da sprint: hora de olhar a Daily',
      dailyText: 'Veja o que está em risco de não entregar enquanto ainda dá para agir.',
      dailyAction: 'Abrir Daily',
      reviewTitle: 'Fim da sprint: hora da Review',
      reviewText: 'Confira o que foi entregue e como os bugs se comportaram na sprint.',
      reviewAction: 'Abrir Review'
    },
    cycle: {
      title: 'Como a plataforma acompanha a sua sprint',
      reviewFirstSteps: 'Rever primeiros passos',
      youAreHere: 'Você está aqui',
      planningStep: '01 · Antes',
      planningText:
        'Monte o escopo da sprint, confira a capacidade por disciplina e gere o resumo para o time.',
      planningLink: 'Abrir Planning',
      dailyStep: '02 · Durante',
      dailyText:
        'Linha do tempo dos itens da sprint: o que andou, o que travou e o que não cabe mais.',
      dailyLink: 'Abrir Daily',
      reviewStep: '03 · Ao fim',
      reviewText:
        'Entregas mostra o que foi concluído; Análise de Bugs mostra criticidade e tempo em cada estado.',
      reviewLink: 'Abrir Review'
    },
    tips: {
      title: 'Dicas rápidas',
      helpTip: 'O ícone <b>?</b> ao lado de um indicador explica a regra por trás do número.',
      collapseMenu: 'Clique no logo para recolher o menu e ganhar espaço na Daily.',
      exportConfig:
        'Em Configuração, exporte a Configuração para levar seus Produtos para outra máquina.'
    },
    welcome: {
      title: 'Boas-vindas à Plataforma do PO',
      text: 'Ela lê o seu Azure DevOps e organiza a sprint em três momentos: Planning, Daily e Review. Siga os passos abaixo para conhecer cada um.'
    },
    firstSteps: {
      title: 'Primeiros passos',
      progress: '{done} de {total}',
      progressLabel: 'Progresso dos primeiros passos',
      done: 'Concluído',
      pending: 'Pendente',
      connectTitle: 'Conectar ao Azure DevOps e cadastrar Produtos',
      planningTitle: 'Montar a primeira Planning',
      planningText: 'Escolha os itens da sprint e veja se cabem na capacidade.',
      dailyTitle: 'Acompanhar uma Daily',
      dailyText: 'Veja o que está em risco de não entregar na sprint corrente.',
      reviewTitle: 'Ver as Entregas da sprint',
      reviewText: 'Na Review, confira o que foi concluído e os bugs abertos.',
      start: 'Começar',
      open: 'Abrir',
      skip: 'Pular e esconder esta lista',
      finish: 'Concluir e ir para a Home'
    },
    demo: {
      title: 'Quer só explorar antes?',
      text: 'A demonstração preenche todas as telas com uma sprint fictícia. Nada toca no seu Azure DevOps.',
      action: 'Abrir demonstração'
    }
  },

  releaseNotes: {
    types: {
      new: 'Novo',
      improvement: 'Melhoria',
      fix: 'Correção'
    },
    allTypes: 'Todos',
    cardTitle: 'Novidades da {version}',
    allNotes: 'Todas as notas de versão',
    open: 'Abrir {screen}',
    installed: 'Instalada',
    versionButton: 'Versão {version}. Ver o histórico de novidades',
    modal: {
      title: 'Novidades da {version}',
      earlier: 'Também desde a sua última versão: {versions}',
      allNotes: 'Ver todas as notas',
      notNow: 'Agora não',
      gotIt: 'Entendi',
      itemTitle: '{title}.',
      // Uma frase por tela por causa do artigo: "no Planning", "na Daily".
      try: {
        home: 'Ir para a Home',
        planning: 'Experimentar no Planning',
        daily: 'Experimentar na Daily',
        'sprint-delivery': 'Ver nas Entregas da Sprint',
        'bug-analysis': 'Ver na Análise de Bugs',
        settings: 'Abrir a Configuração',
        'connect-ai': 'Conectar a sua IA',
        security: 'Abrir a Segurança'
      }
    },
    history: {
      search: 'Buscar por tela, recurso ou versão',
      searchPlaceholder: 'Buscar por tela, recurso ou versão (ex.: Squad, capacidade, 1.2)',
      typeFilter: 'Tipo de novidade',
      count: '{items} em {versions}',
      items: { one: '{count} novidade', other: '{count} novidades' },
      versions: { one: '{count} versão', other: '{count} versões' },
      empty: 'Nenhuma novidade com “{query}”.',
      emptyType: 'Nenhuma novidade deste tipo.',
      clear: 'Limpar a busca'
    }
  },

  profile: {
    loading: 'Carregando o Perfil…',
    loadFailed: 'Não consegui carregar o Perfil deste computador',
    invalidTitle: 'A Configuração deste Perfil tem erros',
    invalidHint:
      'Corrija o arquivo configuracao.json na pasta do Perfil. O app recarrega sozinho quando ele for salvo.',
    staleWarning: 'A Configuração salva tem erros; o app segue com a última versão válida.',
    openFolder: 'Abrir pasta'
  },

  update: {
    title: 'Versão nova disponível:',
    installed: 'Você usa a',
    releaseNotes: 'Ver novidades',
    download: 'Baixar a versão {version}',
    afterDownload:
      'O download abriu no navegador. Abra o instalador: ele atualiza por cima e mantém seus Perfis e o token.',
    dismiss: 'Agora não'
  },
  demo: {
    bannerTitle: 'Dados fictícios de demonstração',
    bannerText: 'Nada aqui vem de um Azure DevOps de verdade, e nada sai deste computador.',
    connect: 'Conectar ao meu Azure',
    backToProfile: 'Voltar para o meu Perfil',
    back: 'Voltar para a demonstração',
    restore: 'Restaurar demonstração',
    restoreConfirmTitle: 'Restaurar a demonstração?',
    restoreConfirmText:
      'Apaga o que você mudou aqui (capacidade, itens do Planning e a Configuração) e volta aos dados de exemplo.'
  },

  pat: {
    intro:
      'Para carregar os dados, o app usa um token pessoal <b>somente leitura</b>. Ele fica guardado <b>criptografado só neste computador</b> — nunca é enviado para nenhum servidor além do Azure DevOps.',
    stepOpenUrl: 'Abra no navegador a página de tokens da organização: {url}',
    stepOpenMenu:
      'No Azure DevOps, clique no ícone de usuário (canto superior direito) → <b>Personal access tokens</b>.',
    stepNewToken: 'Clique em <b>New Token</b>.',
    stepScopes:
      'Em escopos, marque apenas leitura: <b>Work Items → Read</b> e <b>Project and Team → Read</b>.',
    stepGraph:
      'Opcional: em <b>Show all scopes</b>, no rodapé, marque também <b>Graph → Read</b>. É o que permite exibir foto e nome das pessoas; sem ele o app mostra as iniciais.',
    stepCopy: 'Não marque nenhum escopo de escrita. Crie, <b>copie o token</b> e cole abaixo.',
    fieldLabel: 'Personal Access Token (PAT)',
    required: 'Cole o token para continuar',
    validatedHint: 'Validamos o token no Azure antes de salvar.',
    placeholder: 'Cole seu token aqui',
    setupTitle: 'Configure seu acesso ao Azure DevOps',
    saveAndContinue: 'Salvar e continuar',
    saveFailed: 'Não deu para salvar o token'
  },

  help: {
    ruleLabel: 'Regra {rule}',
    ariaLabel: 'Como {title} é calculado',
    rules: {
      'RN-CAT-06': {
        title: 'A publicar',
        text: 'A página está diferente da que veio da wiki na última absorção, ou nunca veio de lá. A regra está gravada no catálogo da pasta, mas ainda não na wiki, que é a versão oficial.'
      },
      'RN-FLX-05': {
        title: 'Fase',
        text:
          'A Fase sai dos arquivos da pasta de trabalho, não da linha "Fase:" do README. Discovery até o checklist fechar; Pronta para quebra quando fecha; Em quebra quando o plano ganha regras; Publicada quando todas estão no catálogo. ' +
          'O estado da Feature no Azure não muda a Fase: quando discorda, aparece como divergência.'
      },
      'RN-FLX-22': {
        title: 'Bugs por Feature',
        text:
          'Um bug chega à Feature por dois caminhos: o vínculo no Azure (filho da Feature ou de um PBI dela) e a regra que ele viola, pela Origem da regra até o plano da Feature. ' +
          'O mesmo bug conta uma vez por Feature, mesmo quando os dois caminhos dão nela. Bug com veredito "Não é bug" não conta.'
      },
      'RN-GLB-16': {
        title: 'Datas da demonstração',
        text:
          'Os dados de exemplo foram gravados numa data fixa e andam em semanas inteiras até a sprint corrente ser a desta semana. ' +
          'Por isso as datas não batem com as do Cenário, mas o dia da semana e o horário de cada mudança são os mesmos.'
      },
      'RN-GLB-17': {
        title: 'Sprints da Squad',
        text:
          'A lista mostra só as sprints dos Produtos desta Squad. Outra Squad pode ter sprints em datas diferentes e as vê na própria aba. ' +
          'Uma Squad só com Produtos de fluxo contínuo usa as sprints de todos os Produtos.'
      },
      // ─── Home ───────────────────────────────────────────────────────────────
      'RN-HOM-02': {
        title: 'Sugestão para agora',
        text:
          'Sai só do calendário da sprint corrente, sem consultar os itens. ' +
          'O primeiro dia e os dias antes de a sprint começar sugerem o Planning; os dois últimos dias e o intervalo até a próxima sprint, a Review; o meio, a Daily.'
      },
      // ─── Review › Entregas da Sprint ────────────────────────────────────────

      'RN-ENT-04': {
        title: 'Itens entregues',
        text:
          'Conta os itens cuja primeira entrega — um dos estados de entrega do Perfil de processo — aconteceu dentro da janela desta sprint. ' +
          'Quem decide é o histórico do item, não o campo de iteração: item planejado em outra sprint e concluído nesta entra aqui, ' +
          'e item reaberto e concluído de novo não conta duas vezes. ' +
          'O total ao lado é o que estava planejado na sprint, esse sim pelo campo de iteração.'
      },

      'RN-ENT-05': {
        title: 'Foco em desenvolvimento',
        text:
          'Fatia das horas desta sprint gastas em construção de produto: os tipos de desenvolvimento do Perfil de processo. ' +
          'Os demais tipos, como Bug, não entram no numerador — são trabalho legítimo, mas não são construção. ' +
          'É essa separação que dá sentido ao indicador.'
      },

      'RN-ENT-09': {
        title: 'Esforço e distribuição por tipo',
        text:
          'Soma as horas que cada tipo consumiu dentro desta sprint, e não o tempo total de vida dos itens. ' +
          'A diferença importa: um item arrastado de sprints anteriores apareceria inflado se usássemos o tempo total. ' +
          'Clique num tipo para filtrar a tabela abaixo.'
      },

      'RN-ENT-06': {
        title: 'Dev. total / sprint',
        text:
          'São duas medidas diferentes. Em cima, o tempo total do item: de quando entrou em desenvolvimento até o fim do desenvolvimento ' +
          '(ex.: Tested) — termina aí, não no fechamento formal, que depende de cerimônia. ' +
          'Embaixo, só o tempo consumido dentro desta sprint, somando as idas e vindas no estado de desenvolvimento. ' +
          'Tudo em horas úteis do calendário da Configuração: só o expediente, sem fim de semana nem feriado.'
      },

      // ─── Review › Análise de Bugs ───────────────────────────────────────────

      'RN-BUG-04': {
        title: 'Bugs em tratamento',
        text:
          'Foto do passivo aberto agora: todos os bugs fora dos estados terminais do processo configurado. ' +
          'Este número não muda ao trocar a sprint selecionada — ele é do presente, não do período.'
      },

      'RN-BUG-06': {
        title: 'Reincidência',
        text:
          'Percentual de bugs criados no período cujo título contém o marcador de reincidência da Configuração. ' +
          'É marcação manual do time, não detecção automática — se a marcação não for feita, a taxa fica subestimada.'
      },

      'RN-BUG-08': {
        title: 'Fechados no SLA',
        text:
          'Bugs fechados até a data limite, sobre o total de bugs que têm data limite definida. ' +
          'Bug sem Due Date fica fora dos dois lados da conta: não conta como cumprido nem como violado.'
      },

      'RN-BUG-09': {
        title: 'Lista de bugs',
        text:
          'Sem filtro ativo, a lista não mostra apenas os bugs criados na sprint. ' +
          'Ela combina três conjuntos, sem repetir: os criados nesta sprint, os fechados nela mas criados antes, e os que seguem abertos de qualquer época. ' +
          'É a lógica de uma reunião de review — o que nasceu, o que morreu e o que continua aberto.'
      },

      'RN-BUG-10': {
        title: 'Como os filtros se combinam',
        text:
          'Filtrar por período — sprint ou mês — troca a base: passa a valer todo o histórico, e não mais a lista combinada. ' +
          'Criticidade e mês limpam os demais filtros; sprint limpa a criticidade só quando é uma sprint diferente da selecionada. ' +
          'Estado é independente: não limpa nada e nada o limpa, porque "onde está travado" combina com qualquer outra pergunta.'
      },

      'RN-BUG-12': {
        title: 'Criticidade',
        text:
          'Distribuição dos bugs criados no período que está visível — que muda conforme o filtro ativo: ' +
          'a sprint clicada no histórico, o mês clicado, ou a sprint selecionada no topo quando não há filtro. ' +
          'A criticidade vem do campo do Azure configurado (o primeiro preenchido, se forem vários), e bugs sem preenchimento aparecem como "Não informado". ' +
          'A cor vem do nível da Configuração cujo prefixo o valor começa.'
      },

      // ─── Daily ──────────────────────────────────────────────────────────────

      'RN-DLY-02': {
        title: 'Como ler a linha do tempo',
        text:
          'A barra de um item iniciado começa no dia real em que ele entrou no estado de desenvolvimento; a parte cheia é o que já foi consumido, até hoje. ' +
          'Itens não iniciados são desenhados a partir de hoje, como projeção — por isso um item que não cabe aparece furando a borda direita. ' +
          'Vermelho é constatação: já passou do estimado. Âmbar é projeção: ainda vai passar. ' +
          'Clicar numa faixa da legenda filtra os três blocos por ela; clicar de novo remove. Os números ao lado ignoram o filtro de faixa, mas respeitam o de responsável.'
      },

      'RN-DLY-19': {
        title: 'Aguardando teste abranda a projeção',
        text:
          'Item no estado de teste do processo com projeção estourada aparece com o consumido na cor de destaque, e não em âmbar: o desenvolvimento já terminou e só falta validar, então a chance de entregar dentro da sprint é alta. O restante segue âmbar, para não fingir que não há aperto. ' +
          'Por isso ele conta em "Termina dentro da sprint", e não em "Projeção fura a sprint".'
      },

      'RN-DLY-17': {
        title: 'Feriado na sprint',
        text:
          'A régua tem uma casa por dia de semana, e o feriado continua ocupando a dele — marcado com ★. Apagar a casa faria a sprint parecer menor e esconderia o dia perdido. ' +
          'A projeção de cada item pula os feriados, então a sprint com feriado empurra os términos: um item estimado na sprint inteira, iniciado no dia 1, passa a exceder a sprint em 1 dia. ' +
          'Passe o mouse sobre a casa marcada para ver qual feriado é. ' +
          'Não é o item que piorou — é a sprint que tem menos dias de trabalho.'
      },

      'RN-DLY-05': {
        title: 'Itens em andamento ao mesmo tempo',
        text:
          'A estimativa assume o time com atenção normal no item. Com trabalho demais aberto em paralelo, nenhum item recebe essa atenção e todos estouram juntos. ' +
          'Se muitos itens ficarem vermelhos de uma vez, olhe este número antes de concluir que as estimativas estão erradas.'
      },

      // ─── Planning ───────────────────────────────────────────────────────────

      'RN-PLN-04': {
        title: 'Ordenação da tabela',
        text:
          'Prioridade crescente primeiro, com 1 no topo. Empate desce para a maior complexidade total, depois para a maior de frontend, de backend e de QA, e por fim para o menor ID. ' +
          'Itens sem prioridade vão para o fim — senão subiriam junto com os mais urgentes.'
      },

      'RN-PLN-24': {
        title: 'Desenvolvimento antecipado',
        text:
          'O percentual é quanto de frontend e de backend o time já fez numa sprint anterior. Fica nesta sprint o restante, arredondado; QA entra sempre integral. ' +
          'O total é a soma das partes. O app guarda só o percentual: se a estimativa mudar no Azure, o desconto acompanha ao atualizar.'
      },
      'RN-PLN-09': {
        title: 'Itens remanescentes',
        text:
          'Itens que sobraram de sprints anteriores e continuam consumindo capacidade, adicionados pelo ID do work item. ' +
          'O percentual informado é quanto ainda falta de frontend e de backend; QA entra sempre integral, porque teste não se faz pela metade. ' +
          'O total é recalculado pela soma das partes, não herdado do Azure. O item precisa ser de um Produto da seleção atual.'
      },

      'RN-PLN-13': {
        title: 'Complexidade planejada',
        text:
          'Soma dos pontos de complexidade apenas dos itens marcados, incluindo remanescentes já rateados. ' +
          'Desmarcar um item o tira da conta mas o mantém visível na tabela — serve para simular "e se esse item não entrar?".'
      },

      'RN-PLN-15': {
        title: 'Capacidade da sprint',
        text:
          'Devs × horas produtivas × dias da sprint, descontando o percentual reservado a bugs — um para frontend e outro para backend. ' +
          'As horas produtivas por dia vêm do Calendário da Configuração e são menos que o expediente: o resto é cerimônia, apoio e interrupção. ' +
          'Frontend e backend são medidos separadamente, e o alocado converte complexidade em horas pela tabela de pontos da Configuração. ' +
          'Abaixo de 95% da capacidade está dentro; de 95% a 100%, no limite; acima de 100%, acima da capacidade.'
      },

      'RN-PLN-18': {
        title: 'Resumo da sprint',
        text:
          'Traz só os itens marcados, na mesma ordem da tabela, do Produto ou Grupo selecionado no filtro — os números batem com os da tela. ' +
          'O uso geral soma o alocado de frontend e backend sobre a capacidade das duas disciplinas; QA não tem capacidade medida. ' +
          'Os desmarcados podem ir numa tabela à parte, como evidência, sem entrar em nenhuma soma. ' +
          'A cópia leva tabelas e links prontos para colar no Loop ou no Teams.'
      },

      'RN-SEC-24': {
        title: 'O que vai no pedido',
        text:
          'O pedido leva o ID, o título, o estado, o Produto, a prioridade e a descrição dos itens marcados. Comentários, pessoas, pontos e anexos ficam. Trechos com forma de token saem trocados por [REDACTED]. ' +
          'O app não envia nada: você copia o pedido para a IA que usa, e o que colar lá vai para a conta dela. A resposta colada de volta é rascunho até você aceitar.'
      },

      // ─── Configuração ───────────────────────────────────────────────────────

      'RN-CFG-02': {
        title: 'ID do Produto',
        text:
          'É a chave com que o app guarda o que você registra: itens manuais do Planning, capacidade, planejamento. ' +
          'Mudar o ID depois de salvo deixa esses dados para trás, mesmo com o nome igual. ' +
          'Por isso o nome muda à vontade e o ID, não.'
      }
    }
  },

  onboarding: {
    intro:
      'Tudo fica neste computador: a Configuração num arquivo que você (ou a sua IA) pode ler, e o token do Azure DevOps guardado criptografado, à parte.',
    eyebrow: 'Primeira execução',
    chooseTitle: 'Como você quer começar?',
    heroTitle: 'Planning, Daily e Review do seu time, sem montar consulta.',
    heroText:
      'Aponte para os seus Produtos no Azure DevOps e acompanhe entregas, bugs e o andamento da sprint.',
    promises: {
      readOnlyTitle: 'Só leitura',
      readOnlyText: 'O app nunca escreve no Azure DevOps.',
      localTitle: 'Tudo local',
      localText: 'Sem servidor e sem conta. O token fica criptografado neste computador.',
      configurableTitle: 'Parametrizável',
      configurableText: 'Produtos, processo e calendário num JSON que você — ou a sua IA — edita.'
    },
    wizardDoorNote: 'Recomendado na primeira vez',
    wizardDoorTitle: 'Configurar com o assistente',
    wizardDoorText:
      'O app lista os projetos, times e áreas da sua organização e você escolhe os seus Produtos.',
    aiDoorTitle: 'Configurar com a sua IA',
    aiDoorText:
      'Conecte o Claude, o Cursor ou o VS Code ao app. A IA pergunta o que precisa saber e propõe a Configuração para você revisar.',
    ai: {
      title: 'Configurar com a sua IA',
      intro:
        'Primeiro, o app precisa da sua organização no Azure DevOps e de um token de leitura. O token fica criptografado neste computador e a sua IA nunca o vê. Depois, o app mostra o que colar na sua IA.',
      validateAndContinue: 'Validar token e continuar',
      continue: 'Continuar'
    },
    importDoorTitle: 'Importar Configuração',
    importDoorText:
      'Já tem um configuracao.json, seu ou de um colega? Escolha o arquivo e informe o seu token.',
    demoDoorTitle: 'Explorar com dados de exemplo',
    demoDoorText:
      'Veja todas as telas funcionando com dados fictícios, sem token e sem organização no Azure.',

    wizard: {
      titleRedo: 'Refazer a Configuração',
      titleFirstRun: 'Configurar a Plataforma',
      stepOf: 'Passo {current} de {total}',
      steps: {
        organization: 'Organização',
        token: 'Token',
        projects: 'Projetos',
        origins: 'Times e áreas',
        products: 'Produtos',
        process: 'Processo',
        fields: 'Campos',
        calendar: 'Calendário',
        review: 'Revisão'
      },
      blockers: {
        noProject: 'Marque pelo menos um projeto.',
        noProduct: 'Cada projeto precisa de pelo menos um Produto.',
        productName: 'Todo Produto precisa de nome.',
        invalidId: 'Há ID inválido ou repetido.',
        groupIncomplete: 'Todo Grupo precisa de nome e de pelo menos dois Produtos.',
        squadIncomplete: 'Toda Squad precisa de nome e de pelo menos um Produto.',
        productWithoutSquad: 'Com Squads, todo Produto precisa estar em uma Squad.',
        noProcess: 'Escolha um Perfil de processo para cada projeto.'
      },
      refused: 'O app recusou a Configuração',
      saveFailed: 'Não deu para salvar',
      saveAndEnter: 'Salvar e entrar',
      cancelWithoutSaving: 'Cancelar sem salvar',
      finishLater: 'Terminar depois'
    },

    organization: {
      intro:
        'O Perfil liga este computador a uma organização do Azure DevOps. Se preferir, cole a URL que aparece no navegador.',
      label: 'Organização no Azure DevOps',
      hint: 'Só o nome, o que vem depois de {host}.',
      placeholder: 'contoso',
      nameOnlyTitle: 'Vamos usar só o nome: {organization}',
      nameOnlyText:
        'A Configuração guarda o nome da organização, nunca um endereço. O app sempre monta dev.azure.com/<organização>, e assim o token só vai para o Azure DevOps (RN-CFG-04).'
    },

    token: {
      validate: 'Validar e continuar',
      createFailed: 'Não deu para criar o Perfil'
    },

    import: {
      title: 'Importar Configuração',
      intro:
        'Escolha um arquivo <code>configuracao.json</code>, ou um Modelo de processo de outro PO. Ele é validado antes de qualquer coisa ser gravada.',
      fileKind: 'Arquivo',
      template: 'Modelo de processo, sem organização nem Produtos',
      templateOrganization:
        'O Modelo não traz a organização. Os Produtos você acrescenta depois, pelo assistente, pelo arquivo ou pela sua IA.',
      tooBig: 'O arquivo passa de 1 MB.',
      invalidJson: 'O arquivo não é um JSON válido.',
      chooseFile: 'Escolher arquivo',
      chooseAnother: 'Escolher outro',
      hasErrors: 'A Configuração tem erros',
      importAndEnter: 'Importar e entrar',
      validateAndEnter: 'Validar token e entrar',
      failed: 'Não deu para concluir'
    },

    projects: {
      intro:
        'Marque os projetos do Azure onde vivem os itens que você acompanha. No próximo passo você diz quais times e áreas de cada projeto formam cada Produto.',
      listFailed: 'Não consegui listar os projetos da organização',
      missingTitle: 'O token não enxerga mais: {projects}',
      missingText:
        'Esses projetos estão na Configuração atual. Desmarque-os ou confira os escopos do token.',
      process: 'Processo',
      defaultTeam: 'Time padrão'
    },

    origins: {
      intro:
        'Para cada projeto, diga de onde vêm os itens de cada Produto. Um projeto pode ter vários Produtos, separados por área.',
      noProject: 'Volte um passo e marque pelo menos um projeto.',
      loadFailed: 'Não consegui ler times e áreas deste projeto',
      unnamedProduct: 'Produto sem nome',
      removeProduct: 'Remover Produto',
      team: 'Time',
      teamHint:
        'Fornece as iterações (sprints). Sem time, valem as iterações com datas do projeto.',
      teamPlaceholder: 'Todas as iterações do projeto',
      includedAreas: 'Áreas incluídas',
      includedAreasHint: 'Cada área entra com as filhas. Nenhuma marcada = o projeto inteiro.',
      includedAreasPlaceholder: 'Projeto inteiro',
      excludedAreas: 'Áreas excluídas',
      excludedAreasHint:
        'Também com as filhas: time de teste interno, suporte, o que não é deste Produto.',
      excludedAreasPlaceholder: 'Nenhuma',
      continuous: 'Fluxo contínuo, sem sprints próprias (fica fora do Planning e da Daily)',
      addProduct: 'Outro Produto neste projeto'
    },

    products: {
      intro: 'O nome e a cor aparecem nas telas e podem mudar quando você quiser.',
      idWarningTitle: 'O ID não muda depois de salvo',
      idWarningText:
        'Os dados que você registra no app (itens manuais do Planning, capacidade) ficam guardados pelo ID. Para mudar o que aparece na tela, mude o nome.',
      color: 'Cor',
      groupsTitle: 'Grupos (opcional)',
      groupsIntro: 'Um Grupo soma dois ou mais Produtos e aparece no filtro como se fosse um só.',
      groupDefaultName: 'Grupo {number}',
      groupNamePlaceholder: 'Nome do Grupo',
      groupProductsPlaceholder: 'Pelo menos dois Produtos',
      removeGroup: 'Remover Grupo',
      addGroup: 'Adicionar Grupo',
      squadsTitle: 'Squads (opcional)',
      squadsIntro:
        'Uma Squad reúne os Produtos com que um time trabalha. Cada Squad vira uma aba no topo do app, e cada Produto fica numa Squad só. Sem Squads, todos os Produtos aparecem juntos.',
      squadDefaultName: 'Squad {number}',
      squadNamePlaceholder: 'Nome da Squad',
      squadColor: 'Cor da Squad',
      squadProductsPlaceholder: 'Produtos da Squad',
      removeSquad: 'Remover Squad',
      addSquad: 'Adicionar Squad',
      withoutSquad: 'Ainda sem Squad: {names}'
    },

    process: {
      intro:
        'O Perfil de processo diz o que cada estado significa: quando um item conta como entregue, quando está em desenvolvimento, o que é bug. A sugestão vem das categorias de estado do Azure; confira, principalmente se o processo foi customizado.',
      loadFailed: 'Não consegui ler o processo de um projeto',
      mappingTitle: 'Projeto → Perfil de processo',
      choosePlaceholder: 'Escolha um Perfil',
      noSuggestion: 'Sem tipo de requisito visível: escolha um Perfil.',
      noneChosen: 'Nenhum Perfil de processo escolhido ainda.',
      profileTitle: 'Perfil de processo "{id}"',
      nonePlaceholder: 'Nenhum',
      estimatePlaceholder: 'Microsoft.VSTS.Scheduling.Effort',
      fields: {
        workItemTypes: {
          label: 'Tipos que contam',
          hint: 'Tipo fora desta lista é ignorado em todas as telas.'
        },
        plannableTypes: {
          label: 'Tipos planejados',
          hint: 'O que o time estima e planeja (Planning e Daily).'
        },
        developmentTypes: {
          label: 'Tipos de construção',
          hint: 'Contam como desenvolvimento de produto no foco da sprint.'
        },
        bugType: { label: 'Tipo de bug', hint: 'Base da Análise de Bugs.' },
        taskType: { label: 'Tipo de tarefa', hint: 'As tarefas filhas mostradas na Daily.' },
        estimateField: {
          label: 'Campo de estimativa',
          hint: 'Scrum usa Effort; Agile usa Story Points.'
        },
        deliveredStates: {
          label: 'Estados de entrega',
          hint: 'Vale a primeira vez que o item entrou em um deles.'
        },
        terminalStates: {
          label: 'Estados terminais',
          hint: 'Entregue, fechado ou removido. Inclui os de entrega.'
        },
        removedStates: {
          label: 'Estados de descarte',
          hint: 'Itens neles saem de todas as contagens.'
        },
        inProgressState: {
          label: 'Em desenvolvimento',
          hint: 'O tempo de desenvolvimento é medido neste estado.'
        },
        devDoneState: {
          label: 'Fim do desenvolvimento',
          hint: 'Opcional (ex.: Resolved). Sem ele, o desenvolvimento termina na entrega.'
        },
        testingState: {
          label: 'Aguardando teste',
          hint: 'Opcional. Na Daily, item neste estado não conta como estouro.'
        },
        bugStateOrder: {
          label: 'Fluxo do bug',
          hint: 'Estados do bug em ordem; o primeiro é onde ele nasce.'
        }
      }
    },

    fields: {
      intro:
        'Tudo aqui é opcional. Se o seu processo tem campos próprios para estes dados, ligue-os; o que ficar vazio aparece nas telas como indicador não configurado.',
      listFailed: 'Não consegui listar os campos',
      notUsedPlaceholder: 'Não usar',
      recurrentTagLabel: 'Marcador de bug reincidente',
      recurrentTagHint:
        'Texto no título que marca um bug que voltou (ex.: "[reincidente]"). Sem ele, a reincidência não é medida.',
      recurrentTagPlaceholder: 'Não medir',
      mappings: {
        reworkCount: {
          label: 'Retrabalho',
          hint: 'Quantas vezes o item voltou para ajuste. Liga o indicador de retrabalho e o destaque na Daily.'
        },
        effortFrontend: {
          label: 'Esforço de frontend',
          hint: 'Estimativa de frontend somada no Planning e comparada com a capacidade.'
        },
        effortBackend: {
          label: 'Esforço de backend',
          hint: 'Estimativa de backend somada no Planning e comparada com a capacidade.'
        },
        effortQa: { label: 'Esforço de QA', hint: 'Estimativa de QA somada no Planning.' },
        criticality: {
          label: 'Criticidade do bug',
          hint: 'Separa os bugs por criticidade na Análise de Bugs. Os níveis ("criticality") se ajustam depois, na Configuração. Mais de um campo: vale o primeiro preenchido.'
        }
      }
    },

    calendar: {
      intro:
        'Toda duração do app é medida em horas úteis: só o expediente, sem fim de semana nem feriado.',
      country: 'País',
      countryHint:
        'Os feriados nacionais são calculados pelo app só para o Brasil, por enquanto. Em outro país, deixe em branco e liste os feriados nacionais abaixo.',
      countryPlaceholder: 'Nenhum (só os feriados abaixo)',
      brazil: 'Brasil',
      extraHolidays: 'Feriados extras',
      extraHolidaysHint: 'Estaduais, municipais, emendas.',
      everyYear: 'Todo ano',
      singleDate: 'Data única',
      monthDayPlaceholder: 'MM-DD',
      datePlaceholder: 'AAAA-MM-DD',
      holidayNamePlaceholder: 'Nome (ex.: Aniversário da cidade)',
      removeHoliday: 'Remover feriado',
      addHoliday: 'Adicionar feriado',
      workingHours: 'Expediente',
      workingHoursHint:
        'Faixas em ordem, sem sobreposição, no formato HH:MM. O almoço fica de fora.',
      removeRange: 'Remover faixa',
      addRange: 'Adicionar faixa',
      productiveHours: 'Horas produtivas por pessoa por dia',
      productiveHoursHint:
        'Menos que o expediente ({hours} h): o resto é cerimônia, apoio e interrupção. Converte estimativa em dias no Planning.'
    },

    review: {
      intro:
        'Confira antes de salvar. Tudo aqui fica no arquivo <code>configuracao.json</code> da pasta do Perfil — sem o token, que fica guardado à parte.',
      fixBeforeSaving: 'Falta corrigir antes de salvar',
      lostTitle: 'Saem da Configuração: {ids}',
      lostText:
        'Os dados registrados no app sob esses IDs (itens manuais do Planning, capacidade) deixam de aparecer. Se a intenção era só renomear, volte e mantenha o ID.',
      customFields: 'Campos customizados',
      noCustomFields: 'nenhum',
      calendar: 'Calendário',
      calendarSummary: '{country} · {holidays} feriado(s) extra(s) · {hours} h produtivas/dia',
      noCountry: 'sem país',
      seeFile: 'Ver o arquivo que será salvo'
    }
  },

  settings: {
    noProfileTitle: 'Nenhum Perfil em uso',
    noProfileText: 'Configure um Perfil para continuar.',
    copyPath: 'Copiar caminho',
    copied: 'Copiado',
    diskErrors: 'O arquivo no disco tem erros; o app segue com a última versão válida',
    profile: 'Perfil',
    noProducts: 'nenhum ainda',
    folder: 'Pasta',
    accentColor: 'Cor de destaque',
    tokenTitle: 'Token do Azure DevOps',
    tokenText: 'Guardado criptografado só neste computador',
    editTitle: 'Editar a Configuração',
    editIntro:
      'A Configuração é o arquivo <code>configuracao.json</code> na pasta do Perfil. Você pode editá-lo à mão ou pedir à sua IA: aponte-a para a pasta — as instruções para ela estão em <code>AGENTS.md</code>. O app percebe quando o arquivo é salvo e recarrega sozinho. O token não fica nessa pasta.',
    aiInstructions: 'Instruções para a IA: {path}',
    openProfileFolder: 'Abrir pasta do Perfil',
    redoWizard: 'Refazer assistente',
    exportConfig: 'Exportar Configuração',
    importConfig: 'Importar Configuração',
    imported: 'Configuração importada',
    export: {
      configuration: 'Configuração completa',
      configurationHint: 'para um colega da mesma organização',
      template: 'Modelo de processo',
      templateHint: 'para um PO de outra empresa, sem os seus Produtos'
    },
    import: {
      title: 'Importar Configuração',
      intro:
        'Escolha uma Configuração completa, de um colega ou de outra máquina, ou um Modelo de processo. O app mostra o que muda antes de gravar, e o token deste Perfil continua o mesmo.',
      templateNote:
        'Este arquivo é um Modelo de processo: ele soma os Perfis de processo e troca campos e calendário, mas mantém a organização, os Produtos e as Squads deste Perfil.',
      chooseFile: 'Escolher arquivo',
      chooseAnother: 'Escolher outro arquivo',
      refused: 'O app recusou este arquivo',
      changes: 'O que muda na Configuração em uso',
      replace: 'Substituir',
      merge: 'Mesclar',
      replaceHint: 'A Configuração deste Perfil passa a ser a do arquivo.',
      mergeHint:
        'O arquivo vence nos IDs iguais; o que só existe neste Perfil fica, e a sua cor de destaque também.',
      apply: 'Aplicar',
      orphans: {
        one: 'Sai {ids}. O Planning e a capacidade guardados com esse ID ficam sem uso.',
        other: 'Saem {ids}. O Planning e a capacidade guardados com esses IDs ficam sem uso.'
      }
    }
  },

  connectAi: {
    intro:
      'Conecte o Claude, o Cursor ou o VS Code a este Perfil. A sua IA passa a ler a Configuração e a propor mudanças, que aparecem aqui para você revisar e aplicar. Ela não recebe o token.',
    loadFailed: 'Não deu para montar o comando da sua IA',
    loading: 'Montando o comando…',
    chooseTitle: 'Escolha a IA que você usa',
    pasteTitle: 'Copie e cole na sua IA',
    askTitle: 'Reinicie a IA e peça',
    askText:
      'Peça <b>“Configure a Plataforma do PO para mim”</b>, ou escolha o prompt <code>configurar_plataforma</code>. A IA pergunta o que precisa saber, explica por quê e grava uma proposta. Ela aparece no topo do app.',
    mergeHint:
      'Se o arquivo já tem outros servidores em "mcpServers", acrescente só o bloco "plataforma-po" dentro dele.',
    copy: 'Copiar',
    copied: 'Copiado',
    openWizard: 'Abrir o assistente',
    safetyTitle: 'O que a sua IA pode fazer',
    safetyText:
      'Ler a Configuração e o fluxo do PO, propor mudanças na Configuração e nas instruções do processo, e gravar arquivos de texto na pasta de trabalho que você escolheu. O servidor que ela inicia não usa a rede nem lê o token, e a Configuração só muda quando você clica em Aplicar.',
    clients: {
      'claude-desktop': {
        label: 'Claude Desktop',
        where:
          'No Claude Desktop, abra <b>Settings → Developer → Edit Config</b> e cole no arquivo <code>claude_desktop_config.json</code>:'
      },
      'claude-code': {
        label: 'Claude Code',
        where:
          'No terminal (PowerShell), uma vez. Para conferir depois, use <code>claude mcp list</code>:'
      },
      cursor: {
        label: 'Cursor',
        where:
          'No Cursor, abra <b>Settings → MCP → Add new server</b>, ou cole no arquivo <code>.cursor/mcp.json</code> da sua pasta de usuário:'
      },
      vscode: {
        label: 'VS Code',
        where:
          'No VS Code, rode o comando <b>MCP: Open User Configuration</b> e cole no arquivo <code>mcp.json</code>:'
      },
      other: {
        label: 'ChatGPT ou outra',
        where:
          'O ChatGPT e outras IAs na web só se conectam a servidores na internet, e a Plataforma do PO não tem servidor. Configure pelo assistente, ou peça à sua IA o arquivo de Configuração e importe em Configuração → Importar.'
      }
    }
  },

  proposal: {
    bannerTitle: 'Sua IA propôs mudanças na Configuração',
    bannerInvalidTitle: 'Sua IA propôs uma Configuração que o app recusou',
    bannerWhen: 'gravada em {when}. Nada muda até você aplicar.',
    review: 'Revisar',
    title: 'Proposta da sua IA',
    intro:
      'Sua IA gravou esta proposta em {when}. Confira o que muda: nada é aplicado até você clicar em Aplicar.',
    invalid: 'O app recusou a proposta',
    discard: 'Descartar'
  },

  configDiff: {
    noChanges: 'Nada muda: o arquivo é igual à Configuração em uso.',
    kind: { added: 'Entra', changed: 'Muda', removed: 'Sai' },
    product: 'Produto',
    group: 'Grupo',
    squad: 'Squad',
    processProfile: 'Perfil de processo',
    sections: {
      organization: 'Organização',
      appearance: 'Cor de destaque',
      customFields: 'Campos customizados',
      criticality: 'Criticidade de bug',
      recurrentBugTag: 'Marcador de bug reincidente',
      calendar: 'Calendário',
      storyPoints: 'Tabela de story points',
      capacityDefaults: 'Valores iniciais da capacidade'
    }
  },

  daily: {
    item: 'Item',
    holidayTooltip: 'Dia {day} · {holiday}, sem trabalho',
    holidayFallback: 'feriado',
    reworkTooltip: {
      one: 'Voltou para retrabalho {count} vez — tempo já gasto que a estimativa não previa',
      other: 'Voltou para retrabalho {count} vezes — tempo já gasto que a estimativa não previa'
    },
    reworkTag: { one: '{count} retrabalho', other: '{count} retrabalhos' },
    estimate: '{points} SP · {days} dias',
    noEstimate: 'sem estimativa',
    startedDay: ' · iniciou dia {day}',
    emptyBlock: 'Nenhum item aqui',
    dayOf: 'dia <b>{current}</b> de {total} · restam {remaining}',
    holidayNotice: {
      one: 'Feriado no dia {days} da sprint. A sprint ocupa {sprintDays} dias no calendário, mas só {workingDays} produzem.',
      other:
        'Feriado nos dias {days} da sprint. A sprint ocupa {sprintDays} dias no calendário, mas só {workingDays} produzem.'
    },
    workingDays: '{workingDays} dias úteis · {holidays}',
    holidayCount: { one: '{count} feriado', other: '{count} feriados' },
    inProgressCount: '{count} em andamento',
    legendOnTrack: 'Termina dentro da sprint',
    legendOverSprint: 'Projeção fura a sprint',
    legendOverEstimate: 'Passou da estimativa',
    legendUnknown: 'Sem estimativa',
    today: 'Hoje',
    assignee: 'Responsável',
    tasksTitle: 'Tasks · {done} de {total} concluídas',
    timeline: {
      overflow: {
        one: 'Excederá a sprint atual em {count} dia',
        other: 'Excederá a sprint atual em {count} dias'
      },
      notFitOverflow: {
        one: 'não cabe — excederá a sprint atual em {count} dia',
        other: 'não cabe — excederá a sprint atual em {count} dias'
      },
      notFitNeeds: 'não cabe — precisa de {days} dias',
      onlyIfToday: 'só se começar hoje',
      fits: '{days} dias · cabe',
      consumedNoEstimate: '{days} dias · sem estimativa para comparar',
      overEstimate: '{days} dias · {diff} além do estimado',
      withinEstimate: '{days} dias · dentro do estimado',
      notThisSprint: 'não termina nesta sprint',
      closesLastDay: 'fecha no último dia',
      progress: '{consumed} de {estimate} dias'
    }
  },

  planning: {
    invalidId: 'Informe um ID numérico válido.',
    alreadyListed: 'Este item já está na lista de planejamento.',
    outOfSelection:
      'O item #{id} é de um Produto fora da seleção atual ({products}). Troque o filtro para o Produto dele e adicione de lá.',
    fetchFailed: 'Erro ao buscar item.',
    addLeftover: 'Adicionar item remanescente',
    itemIdPlaceholder: 'ID do item',
    capacityTitle: 'Capacidade da sprint',
    capacityTitleSquad: 'Capacidade da sprint · Squad {name}',
    capacityWithin: 'Dentro da capacidade',
    capacityAtLimit: 'No limite',
    capacityOver: 'Acima da capacidade',
    frontDevs: 'Devs frontend',
    backDevs: 'Devs backend',
    sprintDays: 'Dias da sprint',
    frontBugPercent: '% de bugs frontend',
    backBugPercent: '% de bugs backend',
    totalAll: 'Total geral',
    workDataFailed: 'Falha ao ler ou gravar o planejamento no Perfil',
    capacityUnavailableTitle: 'Capacidade indisponível',
    capacityUnavailableText:
      'A capacidade compara frontend e backend. Configure "customFields.effortFrontend" ou "customFields.effortBackend" para medi-la.',
    effortOffTitle: 'Divisão de esforço desligada',
    effortOffText:
      'A Configuração não tem campos de esforço. Para ver frontend, backend, QA e a capacidade da sprint, preencha "customFields.effortFrontend", "effortBackend" e "effortQa" com os campos do Azure.',
    complexityPoints: 'pontos de complexidade',
    sprintItems: 'Itens da sprint',
    inCalculation: '{checked} de {total} no cálculo',
    empty: 'Nenhum item planejado para esta sprint.',
    leftover: 'Remanescente',
    priority: 'Prioridade',
    priorityShort: 'P{priority}',
    frontShare: 'Front {percent}%',
    backShare: 'Back {percent}%',
    anticipation: {
      title: 'Desenvolvimento antecipado',
      mark: 'Marcar desenvolvimento antecipado',
      edit: 'Editar desenvolvimento antecipado',
      question:
        'Quanto deste item o time já fez numa sprint anterior? Esses pontos saem do planejamento desta sprint.',
      frontDone: 'Front já feito',
      backDone: 'Back já feito',
      inAzure: '· {points} SP no Azure',
      qaWhole: 'QA entra inteiro nesta sprint.',
      remains: 'Fica nesta sprint:',
      totalChange: 'Total {from} → {to} SP',
      remove: 'Remover antecipação',
      tag: 'Antecipado',
      doneLabel: '{parts} adiantado',
      ofOriginal: '/{points}',
      discounted: '−{points} antecipados descontados'
    },
    goal: {
      title: 'Objetivo da sprint',
      placeholder:
        'Escreva o objetivo da sprint ou traga um rascunho da sua IA. Linhas como "Impacto: ..." e "- item" saem formatadas no resumo.',
      copyRequest: 'Copiar pedido para a sua IA',
      pasteAnswer: 'Colar resposta',
      noItems: 'Marque ao menos um item para montar o pedido.',
      previewTitle: 'Pedido para a sua IA',
      previewIntro: {
        one: '{count} item · ID, título, estado, Produto, prioridade e descrição',
        other: '{count} itens · ID, título, estado, Produto, prioridade e descrição'
      },
      previewMissing: {
        one: '{count} item marcado não foi encontrado na sprint e ficou fora do pedido.',
        other: '{count} itens marcados não foram encontrados na sprint e ficaram fora do pedido.'
      },
      previewHint:
        'Abra uma linha para ler a descrição que vai no pedido. Trechos com forma de token já saem trocados por [REDACTED].',
      previewDestination:
        'O app não envia nada. O que você colar numa IA vai para a conta dela, sob os termos dela.',
      priority: 'Prioridade',
      state: 'Estado',
      description: 'Descrição',
      descriptionChars: '{count} caracteres',
      noDescription: 'Sem descrição',
      copy: 'Copiar pedido',
      copyFailed: 'Não foi possível copiar para a área de transferência. Tente de novo.',
      cancel: 'Cancelar',
      pastePlaceholder: 'Cole aqui a resposta que a sua IA deu ao pedido.',
      readAnswer: 'Ler resposta',
      draftLabel: 'Rascunho colado · revise antes de usar',
      draftFreeForm: 'A resposta não veio no formato pedido e entrou como texto livre.',
      useDraft: 'Usar este texto',
      discard: 'Descartar'
    },

    summary: {
      shareButton: 'Compartilhar resumo',
      modalTitle: 'Resumo da sprint',
      copy: 'Copiar',
      close: 'Fechar',
      pasteHint: 'Cole no Loop ou no Teams com Ctrl+V.',
      copied: 'Resumo copiado. Cole no Loop ou no Teams.',
      copyFailed: 'Não foi possível copiar o resumo.',
      docTitle: 'Planning · {sprint}',
      generatedAt: 'gerado em {date}',
      overview: 'Resumo geral',
      anticipatedNote: {
        one: 'O total já desconta {points} pontos de {count} item antecipado, feitos numa sprint anterior.',
        other:
          'O total já desconta {points} pontos de {count} itens antecipados, feitos numa sprint anterior.'
      },
      anticipatedTag: 'Antecipado · {parts} feito',
      leftoverTag: 'Remanescente · {parts} restante',
      ofOriginal: '{points} (de {original})',
      discipline: 'Disciplina',
      points: 'Pontos',
      usage: 'Uso da capacidade',
      situation: 'Situação',
      sprintShare: '% da sprint',
      capacityParams: '{days} dias de sprint · {hours} produtivas por dia',
      bugReserve: 'Reserva a bugs',
      devs: 'Devs',
      capacity: 'Capacidade',
      allocated: 'Alocado',
      balance: 'Saldo',
      empty: 'Nenhum item marcado para esta sprint.',
      uncheckedNote: {
        one: '{count} item desmarcado na tela ficou fora deste resumo.',
        other: '{count} itens desmarcados na tela ficaram fora deste resumo.'
      },
      showUnchecked: 'Mostrar itens que ficaram fora da sprint ({count})',
      showUncheckedHint:
        'Entram numa tabela à parte, como evidência do que foi avaliado e não coube.',
      outOfSprint: 'Ficaram fora da sprint',
      outOfSprintNote:
        'Avaliados no Planning e desmarcados. Não entram na soma de pontos nem na capacidade.'
    }
  },

  bugs: {
    unknownCriticality: 'Não informado',
    currentSprint: 'Sprint atual',
    clearFilters: 'Limpar filtros',
    empty: 'Nenhum bug encontrado para o período selecionado.',
    createdInMonth: 'Criados no mês',
    createdInSprint: 'Criados na sprint',
    openedInMonth: 'Bugs abertos durante o mês atual',
    openedInSprint: 'Bugs abertos durante a sprint selecionada',
    recurrence: 'Reincidência',
    recurrentCount: '{count} bugs com {tag} no título',
    recurrenceOff: 'Não medida: defina "recurrentBugTag" na Configuração',
    inTreatment: 'Bugs em tratamento',
    activeHint: 'Bugs ativos (não concluídos ou removidos)',
    closedInSla: 'Fechados no SLA',
    withDueDate: '/ {total} com Due Date',
    closedBeforeDue: '{percent}% fechados antes do Due Date',
    noDueDate: 'Nenhum bug com Due Date definido',
    history: 'Histórico de bugs criados',
    clickBar: 'Clique em uma barra para filtrar a lista abaixo',
    criticality: 'Criticidade',
    criticalityOff:
      'Sem campo de criticidade: defina "customFields.criticality" e os níveis em "criticality" na Configuração.',
    noneInSprint: 'Nenhum bug na sprint selecionada.',
    noneInTreatment: 'Nenhum bug em tratamento.',
    bugCount: { one: '{count} bug', other: '{count} bugs' },
    listEmpty: 'Nenhum bug encontrado com os filtros ativos.',
    withinSla: 'Fechado dentro do SLA',
    slaExceeded: 'Excedeu o SLA em {hours}',
    recurrentTag: 'REINC.',
    created: 'Criação',
    closed: 'Fechamento'
  },

  delivery: {
    delivered: 'Itens entregues',
    inSprint: '/ {total} na sprint',
    completion: '{percent}% de conclusão',
    devFocus: 'Foco em desenvolvimento',
    devHours: '{hours} em {types}',
    effortByType: 'Esforço e distribuição por tipo',
    noneDelivered: 'Nenhum item entregue nesta sprint',
    devInSprint: 'Dev na sprint (h)',
    itemCount: '{count} itens',
    noneForFilter: 'Nenhum item para este filtro',
    type: 'Tipo',
    createdClosed: 'Criação / Fechamento',
    devTotal: 'Dev. total / sprint'
  },

  team: {
    partialTitle: 'Alguns gráficos não carregaram',
    partialText: 'Falharam: {charts}. Os demais seguem com dados reais.',
    slaTitle: 'Entrega de SLA por criticidade',
    slaHint: '% de bugs com Due Date fechados dentro do prazo, agrupados por criticidade',
    slaNoLevels:
      'Defina os níveis em "criticality" e o campo em "customFields.criticality" na Configuração para medir o SLA.',
    slaEmpty: 'Nenhum bug com Due Date encontrado para o período.',
    reworkTitle: 'Entregas e rework',
    reworkHint: 'Total de itens entregues e % que passaram por rework',
    reworkUnavailable:
      'Defina "{field}" na Configuração com o campo que conta os retornos do item para medir o rework.',
    reworkEmpty: 'Nenhum item entregue no período.',
    stateTimeTitle: 'Tempo médio em estado',
    stateTimeHint: 'Horas úteis médias que bugs fechados passaram em cada estado do ciclo de vida',
    stateTimeEmpty: 'Nenhum bug fechado no período.',
    stateTimeEmptyForCriticality: 'Nenhum bug fechado no período para esta criticidade.',
    devFocusTitle: 'Foco em desenvolvimento',
    devFocusHint:
      '% de horas em progresso dedicadas aos tipos de desenvolvimento — todos os itens trabalhados na sprint',
    devFocusEmpty: 'Sem horas registradas no período.'
  },

  flow: {
    noProducts: 'Cadastre um Produto na Configuração para ver as Features dele.',
    folder: {
      label: 'Pasta de trabalho',
      choose: 'Escolher a pasta de trabalho',
      change: 'Trocar pasta',
      unsetTitle: '{product} ainda não tem pasta de trabalho',
      unsetText:
        'É lá que moram o Brief, as Decisões e o Plano de PBIs de cada Feature, em features/<pasta>. Sem ela, a tela mostra só as Features abertas no Azure.',
      missingTitle: 'A pasta de trabalho de {product} não foi encontrada',
      missingText:
        'Ela pode ter sido renomeada, movida ou estar num disco desconectado. Escolha de novo.'
    },
    snapshotFailed:
      'Não deu para atualizar o retrato do Azure. A tela mostra o último retrato gravado.',
    snapshotAt: 'Retrato do Azure de {date}',
    noSnapshot: 'Sem retrato do Azure ainda',
    empty: 'Nenhuma Feature aberta no Azure para {product}, e nenhuma pasta em features/.',
    emptyColumn: 'Nenhuma',
    others: 'Arquivadas e fora do fluxo ({count})',
    phases: {
      'Sem Discovery': 'Sem Discovery',
      Discovery: 'Discovery',
      'Pronta para quebra': 'Pronta para quebra',
      'Em quebra': 'Em quebra',
      Publicada: 'Publicada',
      Arquivada: 'Arquivada',
      'Fora do fluxo': 'Fora do fluxo'
    },
    card: {
      draft: 'rascunho',
      pendencies: { one: '{count} pendência', other: '{count} pendências' },
      stale: 'parada há {days} dias',
      divergence: 'diverge do Azure',
      toConfirm: { one: '{count} ID a confirmar', other: '{count} IDs a confirmar' },
      written: '{written} de {active} PBIs escritos'
    },
    detail: {
      folder: 'Pasta:',
      folderPath: 'features/{slug}',
      updated: 'alterada há {days} dias',
      updatedToday: 'alterada hoje',
      readmePhase: 'O README diz "{readme}"; o app calcula {phase}.',
      divergences: 'O Azure discorda',
      reconcile: 'Confirmar no Azure',
      reconcileHint:
        'O app achou estes itens pelo título. Confirme o que é de cada um; só então o ID vai para o arquivo.',
      exact: 'mesmo título',
      similar: 'título parecido',
      ambiguous: 'mais de um serve',
      none: 'nenhum item do Azure com título igual ou parecido',
      confirm: 'É este',
      draftFeature: 'Feature desta pasta',
      checklist: 'Para ficar Pronta para quebra',
      pendencies: 'Pendências',
      noPendencies: 'Nenhuma pendência.',
      rules: 'Regras da Feature',
      line: 'linha {line}',
      stages: {
        Encaixe: 'Encaixe',
        Discovery: 'Discovery',
        Quebra: 'Quebra',
        Regras: 'Regras',
        Acompanhamento: 'Acompanhamento'
      }
    },
    linked: 'ID gravado no arquivo.'
  },

  opportunities: {
    noFeedback:
      'O Produto não declara feedback na Configuração ("poFlow.feedback"): as oportunidades vêm só da conversa com a IA e dos bugs sem regra.',
    noFolder:
      'Sem pasta de trabalho, a tela mostra só os feedbacks do Azure. As oportunidades da conversa e os bugs analisados moram na pasta.',
    empty:
      'Nenhuma oportunidade. Peça à sua IA para resumir e encaixar um feedback, ou traga uma dor na conversa.',
    newFeature: 'Feature nova: {title}',
    columns: {
      opportunity: 'Oportunidade',
      source: 'Origem',
      fit: 'Encaixe',
      feature: 'Feature',
      next: 'O que falta'
    },
    source: { feedback: 'Feedback', conversa: 'Conversa', bug: 'Bug sem regra' },
    fit: {
      'Sem encaixe': 'Sem encaixe',
      Proposto: 'Proposto',
      Encaixada: 'Encaixada',
      Descartada: 'Descartada'
    }
  },

  followUp: {
    noFolder:
      'Sem pasta de trabalho, a tela mostra só os bugs do retrato. As Análises de Bug e o catálogo de regras moram na pasta.',
    noCatalog:
      'O Produto não tem catálogo de regras ("catalog"): sem bugs pela regra violada e sem regras a conferir.',
    unanalyzed: {
      title: 'Bugs sem análise',
      hint: 'Bugs abertos sem arquivo em bugs/. Peça à sua IA para analisá-los com o prompt analisar_bug.',
      empty: 'Todo bug aberto já tem análise.'
    },
    byFeature: {
      title: 'Bugs por Feature',
      empty: 'Nenhum bug ligado a uma Feature, nem pelo Azure nem pela regra violada.',
      bugs: '{count} bugs'
    },
    byRule: {
      title: 'Bugs por regra',
      empty: 'Nenhuma Análise de Bug com veredito "Bug" e regra violada.'
    },
    toConfirm: {
      title: 'Regras a conferir',
      hint: 'Regras "Não validada" cujo PBI já foi entregue: confira em uso e marque a validação no catálogo.',
      empty: 'Nenhuma regra nova entregue esperando conferência.'
    },
    via: { azure: 'Azure', regra: 'Regra', ambos: 'Azure e regra' },
    verdict: { none: 'sem análise' },
    closed: 'fechado',
    columns: {
      bug: 'Bug',
      state: 'Estado',
      verdict: 'Veredito',
      via: 'Caminho',
      rule: 'Regra',
      bugs: 'Bugs',
      pbi: 'PBI entregue',
      file: 'Arquivo'
    }
  },

  instructions: {
    title: 'Instruções do processo',
    intro:
      'O que a sua IA recebe nos prompts do fluxo do PO, pelo servidor MCP. O texto de fábrica segue o processo rule-first; quando a IA propõe um texto novo, ele aparece aqui, e só vale depois de você aplicar.',
    default: 'de fábrica',
    own: 'sua versão',
    read: 'Ler',
    reset: 'Voltar ao de fábrica',
    proposal: 'A IA propôs um texto novo.',
    proposalOf: 'Proposta para {title}',
    apply: 'Aplicar',
    discard: 'Descartar'
  },

  catalog: {
    noSource:
      'O catálogo de {product} não está configurado. Defina "catalog" no Produto, na Configuração: a wiki do Azure DevOps e a página raiz, ou "local" para manter o catálogo só na pasta.',
    noFolder:
      'Escolha a pasta de trabalho de {product} na tela Features: o catálogo mora em catalogo/, dentro dela.',
    sourceWiki: 'Wiki {wiki}, a partir de {root}',
    sourceLocal: 'Catálogo mantido na pasta, sem wiki',
    absorbedAt: 'Absorvido em {date}',
    neverAbsorbed: 'Ainda não absorvido',
    absorb: 'Absorver da wiki',
    empty: 'Nenhuma página em catalogo/ ainda.',
    duplicates: 'O mesmo ID aparece em mais de uma página: {ids}. Vale a primeira.',
    consults: 'Consulta também: {list}',
    consultCount: '{name} ({count} regras)',
    consultMissing: '{name} (sem catálogo)',
    toPublish: 'a publicar',
    noRules: 'nenhuma regra reconhecida',
    rules: { one: '{count} regra', other: '{count} regras' },
    columns: {
      id: 'ID',
      title: 'Regra',
      status: 'Status',
      validation: 'Validação',
      updated: 'Atualizada'
    },
    preview: {
      title: 'Absorver o catálogo da wiki',
      hint: 'O que muda em catalogo/ se a versão da wiki entrar. Nada é gravado até você absorver.',
      confirm: 'Absorver',
      nothing: 'A cópia local já está igual à wiki.',
      useWiki: 'Usar a da wiki',
      added: 'entra: {ids}',
      changed: 'muda: {ids}',
      removed: 'sai: {ids}',
      localOnly: 'Só na pasta, nunca veio da wiki (fica, a publicar): {files}',
      done: 'Catálogo absorvido.',
      status: {
        new: 'nova na wiki',
        changed: 'mudou na wiki',
        unchanged: 'igual',
        'local-changed': 'mudou só aqui (fica, a publicar)',
        conflict: 'mudou nos dois lados',
        'removed-in-wiki': 'saiu da wiki (fica aqui)'
      }
    }
  },

  security: {
    introTitle: 'O que este app faz com o seu token e os seus dados',
    intro:
      'Cada garantia abaixo é uma regra com ID e um teste automatizado que roda em toda mudança do código. Um teste de segurança só entra depois de ter falhado com a barreira desligada.',
    introMore:
      'A lista completa, a autoavaliação OWASP ASVS e os riscos aceitos estão em docs/seguranca.md, no repositório do projeto.',
    installedVersion: 'Versão instalada',
    guaranteesTitle: 'O que o app garante',
    proof: 'Provado por',
    verifyTitle: 'Como conferir você mesmo',
    verifyInstaller:
      'O instalador é o que saiu do código: compare o SHA-256 do arquivo baixado com o publicado na Release desta versão.',
    verifyProvenance:
      'A Release também traz um atestado assinado pela esteira pública, e o laudo de segurança da versão: o resultado dos testes, a varredura do Electron e a lista de dependências.',
    verifyTests: 'No código-fonte da mesma versão, os testes de segurança rodam com:',
    copy: 'Copiar',
    copied: 'Copiado',
    limitsTitle: 'O que o app não protege',
    limits: {
      malware:
        'Programa malicioso rodando com o seu usuário do Windows: a cifragem é amarrada à sua conta. Se ela foi comprometida, revogue o token no Azure DevOps.',
      session: 'Quem usa o seu computador desbloqueado: o app não tem login próprio.',
      scope:
        'O que o token permite fora do app: crie o token só com escopos de leitura e com validade curta.',
      ai: 'O que a sua IA faz com o que você cola nela: o app mostra o pedido, mas não controla o que o fornecedor guarda.',
      signing:
        'O instalador não tem assinatura de código: o Windows avisa "editor desconhecido". A integridade se confere pelo SHA-256.',
      updates:
        'Não há atualização automática: o app avisa quando sai versão nova, e quem baixa e instala é você.'
    },
    guarantees: {
      network: {
        title: 'Seu token só sai da sua máquina para o Azure DevOps',
        detail:
          'Por HTTPS, para a sua organização. Nenhum outro servidor, nem do autor do app. A única outra consulta é a de versão nova no GitHub público, sem token e sem dado seu. A janela não acessa a rede.'
      },
      encryption: {
        title: 'Seu token fica cifrado pelo Windows',
        detail:
          'Guardado com a proteção da sua conta do sistema, fora da pasta do Perfil. Sem cifragem disponível, o app se recusa a guardar.'
      },
      ui: {
        title: 'A tela do app nunca vê o seu token',
        detail:
          'Só o processo principal o lê. A tela sabe apenas se existe um, e nenhum resultado ou erro o carrega.'
      },
      readOnly: {
        title: 'O app só lê o Azure, nunca escreve',
        detail: 'Mesmo que o seu token tenha permissão de escrita.'
      },
      logs: {
        title: 'O token não aparece em log nem em mensagem de erro',
        detail: 'Ele é apagado de tudo o que o app registra, cru ou codificado.'
      },
      config: {
        title: 'O token nunca entra na Configuração',
        detail:
          'O arquivo que você compartilha e a sua IA lê guarda o nome da organização, nunca um endereço nem um segredo.'
      },
      links: {
        title: 'Link de work item não abre nada perigoso',
        detail:
          'Só páginas da sua organização no Azure DevOps vão para o navegador, e o aviso de versão nova abre só a página e o instalador da Release.'
      },
      noProcess: {
        title: 'O app não executa programa nenhum',
        detail:
          'Nem fala com serviço de IA. Para a sua IA vai só o que você vê na prévia, e quem cola é você.'
      },
      mcp: {
        title: 'Conectada pelo MCP, a sua IA propõe e só escreve na pasta de trabalho',
        detail:
          'O servidor que a sua IA inicia não usa rede nem lê o token. A Configuração e as instruções do processo ela só propõe, e nada muda até você aplicar. Arquivo ela grava só dentro da pasta de trabalho que você escolheu.'
      },
      window: {
        title: 'A janela roda isolada',
        detail:
          'Em sandbox, sem acesso ao sistema, sem câmera, microfone ou notificação. A configuração do Electron é varrida por uma ferramenta independente.'
      },
      installer: {
        title: 'O instalador sai da esteira pública',
        detail:
          'Construído pelo GitHub Actions a partir do código, com o SHA-256 publicado. Nenhum instalador oficial é feito na máquina de alguém.'
      }
    }
  }
} as const
