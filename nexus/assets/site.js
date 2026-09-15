(function () {
  'use strict';

  document.documentElement.classList.add('js');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var translations = {
    ru: {
      'a11y.skip':'К содержанию','nav.product':'Продукт','nav.solutions':'Возможности','nav.deployment':'Размещение','nav.updates':'Обновления','nav.account':'Кабинет','nav.get':'Получить Nexus',
      'hero.kicker':'NEXUS / СИСТЕМА УПРАВЛЕНИЯ КОМПАНИЕЙ','hero.title':'Вся работа компании.<br><em>В одном Nexus.</em>','hero.lede':'Персональный workspace, AI-инструменты, звонки, виджеты и локальные системы. Nexus собирается вокруг вашего процесса и показывает каждому сотруднику только нужное.','hero.primary':'Посмотреть продукт','hero.secondary':'Nexus для Windows','hero.note':'ДОСТУП ПО ПРИГЛАШЕНИЮ · WINDOWS + WEB · УПРАВЛЯЕМОЕ ОБСЛУЖИВАНИЕ','hero.status1':'ПОД ВАШ ПРОЦЕСС','hero.status2':'ВНУТРИ РАБОТЫ','hero.status3':'ГИБРИДНЫЙ КОНТУР',
      'sat.call':'Звонок анализируется','sat.node':'ЗАЩИЩЁННОЕ СОЕДИНЕНИЕ','sat.widget':'НОВЫЙ ВОПРОС В БАЗУ','sat.control':'Контроль расхода','sat.usage':'64% ОТ МЕСЯЧНОГО ПЛАНА',
      'demo.online':'Система в норме','demo.space':'Пространство','demo.overview':'Обзор','demo.calls':'Звонки + AI','demo.widget':'AI-виджет','demo.local':'Local Node','demo.company':'Ваша компания','demo.role':'OWNER ACCESS','demo.caption':'Прокручивайте или выберите раздел внутри интерфейса',
      'rail.workspace':'РАБОЧИЕ ПРОЦЕССЫ','rail.calls':'АНАЛИЗ ЗВОНКОВ','rail.widget':'AI-ВИДЖЕТ','rail.cloud':'ОБЛАЧНЫЙ КОНТУР','rail.usage':'КОНТРОЛЬ РАСХОДА','rail.projects':'ПРОЕКТЫ','rail.finance':'ФИНАНСЫ','rail.team':'КОМАНДА','rail.automation':'АВТОМАТИЗАЦИИ','rail.support':'ПОДДЕРЖКА','rail.security':'БЕЗОПАСНОСТЬ',
      'overview.title':'Рабочий день под контролем','overview.sub':'Продукты, команда и системные события — в одном экране.','overview.action':'Новое действие','overview.m1':'Продукты','overview.m1s':'все доступны','overview.m2':'Сервисы','overview.m2s':'стабильно','overview.m3':'AI usage','overview.m3s':'в пределах плана','overview.products':'Мои продукты','overview.synced':'СИНХРОНИЗИРОВАНО','overview.ws':'Проекты · Клиенты · Финансы','overview.call':'Анализ · Суфлёр · Тренер','overview.widget':'Диалоги · Знания · Лиды','overview.node':'1С · Файлы · Бэкапы','overview.activity':'Активность','overview.week':'7 ДНЕЙ','overview.normal':'Нормальная нагрузка',
      'status.active':'АКТИВЕН','status.online':'ONLINE','status.secure':'ЗАЩИЩЕНО',
      'calls.title':'AI рядом во время разговора','calls.sub':'Транскрипция, подсказки и разбор качества — без переключения окон.','calls.live':'РАЗГОВОР ИДЁТ','calls.client':'Входящий звонок','calls.manager':'МЕНЕДЖЕР · 02:18','calls.customer':'КЛИЕНТ · 02:29','calls.line1':'Подскажите, что для вас важнее: скорость запуска или полный набор функций?','calls.line2':'Нужно запустить быстро, но потом подключить команду и отчётность.','calls.line3':'Тогда начнём с основного процесса и добавим модули после запуска...','calls.coach':'AI-СУФЛЁР','calls.tiptitle':'Зафиксируйте следующий шаг','calls.tip':'Предложите короткий запуск и назовите конкретную дату следующего созвона.','calls.insert':'Добавить в заметку','calls.quality':'КАЧЕСТВО РАЗГОВОРА','calls.score':'Хорошо выявлена задача. Не хватает договорённости по сроку.',
      'widget.title':'Видно, что спрашивают клиенты','widget.sub':'Диалоги, конверсия подсказок и вопросы, которых не хватает в базе знаний.','widget.assistant':'Консультант','widget.bot1':'Здравствуйте! Помогу подобрать решение и отвечу на вопросы.','widget.user1':'Можно подключить это к нашей CRM?','widget.bot2':'Да. Сначала проверю ваш сценарий и предложу безопасный способ интеграции.','widget.placeholder':'Введите сообщение...','widget.gaps':'Пробелы в знаниях','widget.q1':'Срок подключения CRM','widget.q1s':'спросили 8 раз','widget.q2':'Стоимость дополнительной роли','widget.q2s':'спросили 5 раз','widget.coverage':'Покрытие базы',
      'local.title':'Локальные данные остаются локально','local.sub':'Nexus управляет лицензией и заданиями. Файлы, 1С и закрытые операции остаются на компьютере компании.','local.outbound':'ИСХОДЯЩЕЕ СОЕДИНЕНИЕ','local.e1':'Последняя связь','local.now':'сейчас','local.e2':'Резервная копия','local.e3':'Входящие порты',
      'system.title':'Не восемь сервисов.<br><em>Одна рабочая среда.</em>','system.lede':'Nexus не заставляет компанию подстраиваться под готовую CRM. Мы собираем только те модули, которые нужны вашему процессу.','compare.before':'ДО NEXUS · РАЗРОЗНЕННО','compare.chats':'Чаты','compare.calls':'Звонки','compare.docs':'Документы','compare.after':'ПОСЛЕ · ОДИН КОНТУР','compare.status':'Один статус. Один процесс.','system.c1t':'Процесс, который узнаёт команда','system.c1d':'Проекты, лиды, документы, деньги и сотрудники — в логике вашей компании, а не чужого шаблона.','system.c2t':'AI работает внутри задачи','system.c2d':'Анализирует звонки, помогает менеджеру, проверяет документы и замечает то, что обычно теряется.','system.c3t':'Расход и качество видны сразу','system.c3d':'Лимиты, токены, ответы без результата, статусы сервисов и подписка — без слепых зон.',
      'worlds.title':'Один Nexus.<br><em>Разные рабочие миры.</em>','worlds.lede':'Продукт начинается с задачи, а не с длинного списка одинаковых функций.','worlds.w1t':'Работа движется по понятному маршруту','worlds.w1d':'У каждого проекта есть статус, ответственный, следующий шаг и короткая заметка. Руководитель видит картину, команда — только свою работу.','worlds.w1a':'Роли и доступы','worlds.w1b':'Статусы вручную','worlds.w1c':'Финансы и команда','worlds.projects':'Проекты','worlds.synced':'СИНХРОНИЗИРОВАНО','worlds.new':'НОВЫЕ','worlds.progress':'В РАБОТЕ','worlds.review':'ПРОВЕРКА','worlds.task1':'Новая заявка','worlds.task2':'Импорт базы','worlds.task3':'Демо проекта','worlds.task4':'Демо готово','worlds.task5':'Отчёт звонка','worlds.note1':'проверить задачу','worlds.note2':'статус и заметка','worlds.note3':'обновить знания','worlds.note4':'готовится версия','worlds.note5':'ждёт подтверждения','worlds.w2t':'AI не просто отвечает — он улучшает работу','worlds.w2d':'Суфлёр подсказывает во время звонка, тренер разбирает разговор после него, а виджет показывает, каких знаний не хватает клиентам.','worlds.w2a':'Подсказки в реальном времени','worlds.w2b':'Персональный разбор','worlds.w2c':'Контроль качества','worlds.calllive':'ЗВОНОК · LIVE','worlds.i1':'Уточните критерий выбора<small>LIVE COACH</small>','worlds.i2':'Следующий шаг не назначен<small>CALL REVIEW</small>','worlds.i3':'Новый вопрос для базы<small>WIDGET INSIGHT</small>','worlds.w3t':'Облако управляет. Локальный узел исполняет.','worlds.w3d':'Закрытые файлы и 1С остаются внутри компании. Nexus доставляет подписанные задания, версии и настройки через исходящее соединение.','worlds.w3a':'Без входящих портов','worlds.w3b':'Отзыв лицензии','worlds.w3c':'Управляемые обновления','worlds.ops1':'ЛИЦЕНЗИЯ · ВЕРСИИ · HEALTH','worlds.ops2':'1С · ФАЙЛЫ · БЭКАПЫ','worlds.job1':'Резервная копия завершена','worlds.job2':'Версия подтверждена','worlds.job3':'Входящие порты',
      'deploy.title':'Размещается там,<br><em>где это разумно.</em>','deploy.lede':'Архитектура выбирается по данным, нагрузке и процессу. Подписка оплачивает не “ярлык на компьютере”, а лицензирование, AI, обновления, мониторинг и поддержку.','deploy.localt':'На компьютере компании','deploy.locald':'Закрытые операции выполняются локально. Управление версиями, лицензией и поддержкой остаётся в Nexus.','deploy.compute':'Вычисления','deploy.clientpc':'ПК клиента','deploy.closed':'Закрытые данные','deploy.localkeep':'Локально','deploy.cost':'Обслуживание','deploy.lower':'Ниже','deploy.best':'ОПТИМАЛЬНЫЙ БАЛАНС','deploy.hybridt':'Облако + Local Node','deploy.hybridd':'Команда работает 24/7 в облаке, а 1С, файлы и резервные копии остаются внутри компании.','deploy.access':'Доступ команды','deploy.private':'Закрытый контур','deploy.onpc':'На ПК','deploy.scale':'Масштабирование','deploy.flex':'Гибкое','deploy.cloudt':'В контуре Vertux','deploy.cloudd':'Сервер, мониторинг, резервирование и обновления обслуживаются централизованно.','deploy.infra':'Инфраструктура','deploy.maint':'Обслуживание','deploy.full':'Полное',
      'portal.title':'Продукт остаётся<br><em>под вашим контролем.</em>','portal.lede':'В веб-кабинете видны продукты, подписка, версии, расход AI и обращения. Изменения базы знаний и настроек не требуют переписки по каждому поводу.','portal.login':'Войти в кабинет','portal.changelog':'История обновлений','portal.connected':'ПОДКЛЮЧЕНО','portal.plan':'ТЕКУЩИЙ ПЛАН','portal.usage':'AI USAGE','portal.renewal':'Следующее продление','portal.manage':'Управление',
      'final.title':'Ваш процесс.<br><em>Собран в продукт.</em>','final.lede':'Начнём с одной рабочей задачи, соберём Nexus и подключим нужные модули без лишней инфраструктуры.','final.contact':'Обсудить Nexus','final.windows':'Версия для Windows',
      'footer.note':'Персональные бизнес-системы Vertux.','footer.product':'ПРОДУКТ','footer.access':'ДОСТУП','footer.windows':'Windows','footer.contact':'СВЯЗЬ','footer.made':'Сделано в студии <b>Vertux</b>',
      'updates.kicker':'ОБНОВЛЕНИЯ / NEXUS','updates.title':'Nexus становится сильнее.<br><em>Версия за версией.</em>','updates.lede':'Здесь фиксируются изменения продукта, клиентского кабинета и локального узла. Без маркетингового шума — только то, что стало удобнее, быстрее или безопаснее.','updates.back':'Вернуться к продукту','updates.access':'Получить доступ','updates.v040t':'Новый продуктовый сайт','updates.v040d':'Перестроили презентацию Nexus вокруг реального интерфейса и сценария работы.','updates.v040a':'Полная русская и английская версии','updates.v040b':'Интерактивные режимы Workspace, Calls, Widget и Local Node','updates.v040c':'Отдельные страницы кабинета, Windows и обновлений','updates.v030t':'Call Intelligence','updates.v030d':'Добавили продуктовый сценарий для анализа звонков и помощи менеджеру.','updates.v030a':'Транскрипция в реальном времени','updates.v030b':'AI-суфлёр во время разговора','updates.v030c':'Оценка качества и персональный тренер после звонка','updates.v020t':'Hybrid Runtime','updates.v020d':'Сформировали безопасную схему совместной работы облака и локального компьютера.','updates.v020a':'Local Node для Windows','updates.v020b':'Исходящее TLS-соединение без открытых портов','updates.v020c':'Управляемые лицензии и обновления',
      'download.kicker':'NEXUS / WINDOWS','download.title':'Nexus там,<br><em>где работает команда.</em>','download.lede':'Windows-версия устанавливает защищённый Nexus. Доступ к конкретному workspace выдаётся отдельным кодом и подключается после проверки продукта.','download.back':'К продукту','download.changelog':'Что нового','download.cardt':'Nexus для Windows','download.cardd':'Локальный клиент, защищённый доступ к продуктам и Local Node для систем, которые остаются на компьютере компании.','download.request':'Запросить установку','download.req':'Системные требования','download.os':'Система','download.arch':'Архитектура','download.ram':'Память','download.net':'Соединение','download.note':'Установка выдаётся после настройки продукта: универсального файла без лицензии и контура компании нет. Это защищает клиентские данные и сам Nexus.','download.webt':'Web Access','download.webd':'Для сотрудников, которым нужен браузерный доступ без установки. Адрес выдаётся вместе с приглашением в компанию.','download.account':'Открыть кабинет',
      'account.kicker':'CLIENT ACCESS','account.title':'Ваш Nexus.<br><em>Ваши продукты.</em>','account.lede':'Один вход к workspace, AI-инструментам, подписке, версиям и поддержке.','account.b1':'Только продукты вашей компании','account.b2':'Роли и изолированные данные','account.b3':'Лицензии и обновления под контролем','account.formkicker':'ВХОД ПО ПРИГЛАШЕНИЮ','account.formtitle':'Войти в Nexus','account.formlede':'Используйте данные, которые были выданы при подключении компании.','account.email':'Рабочая почта','account.password':'Пароль','account.submit':'Продолжить','account.help':'Нет приглашения или изменился адрес входа?','account.contact':'Написать в Vertux','account.message':'Демо-форма не принимает и не отправляет данные. В рабочей версии вход подключается к серверу вашей компании.'
    },
    en: {
      'a11y.skip':'Skip to content','nav.product':'Product','nav.solutions':'Capabilities','nav.deployment':'Deployment','nav.updates':'Updates','nav.account':'Account','nav.get':'Get Nexus',
      'hero.kicker':'NEXUS / COMPANY OPERATING SYSTEM','hero.title':'Your entire company.<br><em>Inside one Nexus.</em>','hero.lede':'A personal workspace, AI tools, calls, widgets and local systems. Nexus is shaped around your process and gives every teammate exactly what they need.','hero.primary':'Explore the product','hero.secondary':'Nexus for Windows','hero.note':'INVITE-ONLY ACCESS · WINDOWS + WEB · MANAGED SERVICE','hero.status1':'BUILT AROUND YOUR FLOW','hero.status2':'INSIDE THE WORK','hero.status3':'HYBRID BY DESIGN',
      'sat.call':'Call analysis in progress','sat.node':'SECURE CONNECTION','sat.widget':'NEW KNOWLEDGE GAP','sat.control':'Usage control','sat.usage':'64% OF MONTHLY PLAN',
      'demo.online':'All systems normal','demo.space':'Workspace','demo.overview':'Overview','demo.calls':'Calls + AI','demo.widget':'AI Widget','demo.local':'Local Node','demo.company':'Your company','demo.role':'OWNER ACCESS','demo.caption':'Scroll or choose a section inside the interface',
      'rail.workspace':'WORKFLOWS','rail.calls':'CALL INTELLIGENCE','rail.widget':'AI WIDGET','rail.cloud':'MANAGED CLOUD','rail.usage':'USAGE CONTROL','rail.projects':'PROJECTS','rail.finance':'FINANCE','rail.team':'TEAM','rail.automation':'AUTOMATIONS','rail.support':'SUPPORT','rail.security':'SECURITY',
      'overview.title':'Your workday, under control','overview.sub':'Products, team and system events on a single screen.','overview.action':'New action','overview.m1':'Products','overview.m1s':'all available','overview.m2':'Services','overview.m2s':'stable','overview.m3':'AI usage','overview.m3s':'within plan','overview.products':'My products','overview.synced':'SYNCED','overview.ws':'Projects · Clients · Finance','overview.call':'Analysis · Copilot · Coach','overview.widget':'Dialogs · Knowledge · Leads','overview.node':'ERP · Files · Backups','overview.activity':'Activity','overview.week':'7 DAYS','overview.normal':'Normal load',
      'status.active':'ACTIVE','status.online':'ONLINE','status.secure':'SECURE',
      'calls.title':'AI stays with you during the call','calls.sub':'Live transcription, guidance and quality review — no window switching.','calls.live':'CALL IN PROGRESS','calls.client':'Incoming call','calls.manager':'MANAGER · 02:18','calls.customer':'CUSTOMER · 02:29','calls.line1':'What matters more to you: launching quickly or having the full feature set?','calls.line2':'We need to launch fast, then add the team and reporting.','calls.line3':'Then we can start with the core process and add modules after launch...','calls.coach':'AI COPILOT','calls.tiptitle':'Lock in the next step','calls.tip':'Offer a short launch and name a specific date for the next call.','calls.insert':'Add to note','calls.quality':'CALL QUALITY','calls.score':'The task was identified well. A concrete deadline is still missing.',
      'widget.title':'See what customers actually ask','widget.sub':'Conversations, suggestion conversion and questions missing from your knowledge base.','widget.assistant':'Assistant','widget.bot1':'Hello! I can help you choose a solution and answer your questions.','widget.user1':'Can this connect to our CRM?','widget.bot2':'Yes. I will first review your workflow and suggest a secure integration route.','widget.placeholder':'Type a message...','widget.gaps':'Knowledge gaps','widget.q1':'CRM connection timeline','widget.q1s':'asked 8 times','widget.q2':'Additional user pricing','widget.q2s':'asked 5 times','widget.coverage':'Knowledge coverage',
      'local.title':'Local data stays local','local.sub':'Nexus manages licensing and jobs. Files, ERP data and sensitive operations stay on the company computer.','local.outbound':'OUTBOUND CONNECTION','local.e1':'Last connection','local.now':'now','local.e2':'Last backup','local.e3':'Inbound ports',
      'system.title':'Not eight services.<br><em>One operating system.</em>','system.lede':'Nexus does not force your company into a generic CRM. We assemble only the modules your workflow actually needs.','compare.before':'BEFORE NEXUS · FRAGMENTED','compare.chats':'Chats','compare.calls':'Calls','compare.docs':'Documents','compare.after':'AFTER · ONE CONTROL LAYER','compare.status':'One status. One process.','system.c1t':'A process your team already understands','system.c1d':'Projects, leads, documents, money and people — shaped around your company, not someone else’s template.','system.c2t':'AI works inside the task','system.c2d':'It reviews calls, supports managers, checks documents and catches what usually gets missed.','system.c3t':'Cost and quality stay visible','system.c3d':'Limits, tokens, unresolved answers, service health and subscriptions — no blind spots.',
      'worlds.title':'One Nexus.<br><em>Different work worlds.</em>','worlds.lede':'The product starts with a problem, not a generic feature list.','worlds.w1t':'Work follows a clear route','worlds.w1d':'Every project has a status, owner, next step and a short note. Leaders see the whole picture; teammates see their work.','worlds.w1a':'Roles and permissions','worlds.w1b':'Manual statuses','worlds.w1c':'Finance and team','worlds.projects':'Projects','worlds.synced':'SYNCED','worlds.new':'NEW','worlds.progress':'IN PROGRESS','worlds.review':'REVIEW','worlds.task1':'New request','worlds.task2':'Database import','worlds.task3':'Project demo','worlds.task4':'Demo ready','worlds.task5':'Call report','worlds.note1':'review the brief','worlds.note2':'status and short note','worlds.note3':'update knowledge','worlds.note4':'building preview','worlds.note5':'awaiting approval','worlds.w2t':'AI does more than answer — it improves work','worlds.w2d':'The copilot guides live calls, the coach reviews them afterwards, and the widget reveals missing customer knowledge.','worlds.w2a':'Real-time guidance','worlds.w2b':'Personal review','worlds.w2c':'Quality control','worlds.calllive':'CALL · LIVE','worlds.i1':'Clarify the buying criterion<small>LIVE COACH</small>','worlds.i2':'Next step is not scheduled<small>CALL REVIEW</small>','worlds.i3':'New knowledge gap<small>WIDGET INSIGHT</small>','worlds.w3t':'Cloud controls. The local node executes.','worlds.w3d':'Sensitive files and ERP data stay in the company. Nexus delivers signed jobs, versions and settings over an outbound connection.','worlds.w3a':'No inbound ports','worlds.w3b':'Revocable license','worlds.w3c':'Managed updates','worlds.ops1':'LICENSE · VERSIONS · HEALTH','worlds.ops2':'ERP · FILES · BACKUPS','worlds.job1':'Backup completed','worlds.job2':'Version verified','worlds.job3':'Inbound ports',
      'deploy.title':'Runs where<br><em>it makes sense.</em>','deploy.lede':'Architecture follows the data, load and process. The subscription pays for licensing, AI, updates, monitoring and support — not a shortcut on a desktop.','deploy.localt':'On the company computer','deploy.locald':'Sensitive operations run locally. Version, license and support control stay in Nexus.','deploy.compute':'Compute','deploy.clientpc':'Client PC','deploy.closed':'Sensitive data','deploy.localkeep':'Local','deploy.cost':'Service cost','deploy.lower':'Lower','deploy.best':'BEST BALANCE','deploy.hybridt':'Cloud + Local Node','deploy.hybridd':'The team works in the cloud 24/7 while ERP, files and backups stay inside the company.','deploy.access':'Team access','deploy.private':'Private layer','deploy.onpc':'On PC','deploy.scale':'Scaling','deploy.flex':'Flexible','deploy.cloudt':'Managed by Vertux','deploy.cloudd':'Server, monitoring, backups and updates are managed centrally.','deploy.infra':'Infrastructure','deploy.maint':'Maintenance','deploy.full':'Full',
      'portal.title':'Your product stays<br><em>under your control.</em>','portal.lede':'The web account shows products, subscription, versions, AI usage and support. Knowledge and settings can change without a message for every small update.','portal.login':'Open account','portal.changelog':'View changelog','portal.connected':'CONNECTED','portal.plan':'CURRENT PLAN','portal.usage':'AI USAGE','portal.renewal':'Next renewal','portal.manage':'Manage',
      'final.title':'Your process.<br><em>Built into a product.</em>','final.lede':'We start with one operational task, assemble Nexus and connect the right modules without unnecessary infrastructure.','final.contact':'Discuss Nexus','final.windows':'Windows version',
      'footer.note':'Personal business systems by Vertux.','footer.product':'PRODUCT','footer.access':'ACCESS','footer.windows':'Windows','footer.contact':'CONTACT','footer.made':'Made by <b>Vertux</b> Studio',
      'updates.kicker':'UPDATES / NEXUS','updates.title':'Nexus gets stronger.<br><em>Release by release.</em>','updates.lede':'Product, client portal and local node changes. No marketing noise — only what became clearer, faster or safer.','updates.back':'Back to product','updates.access':'Get access','updates.v040t':'New product website','updates.v040d':'Rebuilt the Nexus presentation around the real interface and operational scenarios.','updates.v040a':'Complete Russian and English versions','updates.v040b':'Interactive Workspace, Calls, Widget and Local Node modes','updates.v040c':'Separate Account, Windows and Updates pages','updates.v030t':'Call Intelligence','updates.v030d':'Added a product scenario for call analysis and manager support.','updates.v030a':'Real-time transcription','updates.v030b':'AI copilot during the call','updates.v030c':'Quality score and personal coach after the call','updates.v020t':'Hybrid Runtime','updates.v020d':'Designed a secure shared architecture for cloud and local computers.','updates.v020a':'Local Node for Windows','updates.v020b':'Outbound TLS connection with no open ports','updates.v020c':'Managed licenses and updates',
      'download.kicker':'NEXUS / WINDOWS','download.title':'Nexus where<br><em>your team works.</em>','download.lede':'The Windows build installs the protected Nexus shell. Access to a specific workspace is issued with a separate code after the product has been verified.','download.back':'Back to product','download.changelog':'What’s new','download.cardt':'Nexus for Windows','download.cardd':'Local client, secure product access and Local Node for systems that remain on the company computer.','download.request':'Request installation','download.req':'System requirements','download.os':'Operating system','download.arch':'Architecture','download.ram':'Memory','download.net':'Connection','download.note':'Installation is issued after product setup. There is no universal unlicensed package. This protects client data and Nexus itself.','download.webt':'Web Access','download.webd':'For teammates who need browser access without an installation. The address is included with the company invitation.','download.account':'Open account',
      'account.kicker':'CLIENT ACCESS','account.title':'Your Nexus.<br><em>Your products.</em>','account.lede':'One sign-in for workspace, AI tools, subscription, versions and support.','account.b1':'Only your company products','account.b2':'Roles and isolated data','account.b3':'Licenses and updates under control','account.formkicker':'INVITE-ONLY SIGN IN','account.formtitle':'Sign in to Nexus','account.formlede':'Use the credentials issued when your company was connected.','account.email':'Work email','account.password':'Password','account.submit':'Continue','account.help':'No invitation or sign-in address changed?','account.contact':'Contact Vertux','account.message':'The demo form does not collect or send data. Production sign-in connects to your company server.'
    }
  };
  Object.assign(translations.ru, {
    'hero.kicker':'NEXUS / ПЕРСОНАЛЬНАЯ СИСТЕМА ДЛЯ БИЗНЕСА',
    'hero.title':'Ваш процесс.<br><em>Собран в Nexus.</em>',
    'hero.lede':'Не ещё одна готовая CRM. Мы превращаем логику вашей компании в единое рабочее пространство с нужными статусами, AI и интеграциями.',
    'hero.layer1':'Рабочий процесс','hero.layer2':'AI и знания','hero.layer3':'Интеграции',
    'hero.status1':'ПО ЛОГИКЕ КОМПАНИИ','hero.status2':'В КОНТЕКСТЕ ЗАДАЧ','hero.status3':'ОБЛАКО + ЛОКАЛЬНЫЕ ДАННЫЕ',
    'sat.request':'Статус обновлён','sat.requestSub':'СЛЕДУЮЩИЙ ШАГ НАЗНАЧЕН','sat.checked':'Документ проверен','sat.checkedSub':'НАЙДЕН РИСК В СРОКАХ','sat.connected':'Источник подключён','sat.connectedSub':'ФОРМА → РАБОЧИЙ ПРОЦЕСС','sat.control':'Расход под контролем','sat.usage':'ЛИМИТ И ПРОГНОЗ ВИДНЫ',
    'demo.window':'NEXUS / РАБОЧИЙ КОНТУР КОМПАНИИ','demo.process':'Процесс','demo.knowledge':'AI и знания','demo.integrations':'Интеграции',
    'rail.processes':'ПРОЦЕССЫ','rail.requests':'ЗАПРОСЫ','rail.documents':'ДОКУМЕНТЫ','rail.approvals':'СОГЛАСОВАНИЯ','rail.knowledge':'ЗНАНИЯ','rail.integrations':'ИНТЕГРАЦИИ','rail.analytics':'АНАЛИТИКА',
    'overview.eyebrow':'ОБЗОР / ДЕМО','overview.title':'Рабочий день в одном контуре','overview.sub':'Процессы, команда и важные события собраны в понятную картину.','overview.m1':'Активные процессы','overview.m1s':'все назначены','overview.m2':'Выполнено в срок','overview.m2s':'за эту неделю','overview.m3':'AI-лимит','overview.m3s':'прогноз в норме','overview.products':'Рабочие контуры','overview.requests':'Запросы','overview.requestsSub':'Новые · В работе · Решено','overview.projects':'Проекты','overview.projectsSub':'Этапы · Команда · Бюджет','overview.docs':'Документы','overview.docsSub':'Проверка · Согласование · Архив','overview.integrations':'Интеграции','overview.integrationsSub':'Сайт · CRM · Локальные данные','overview.activity':'Ритм процессов','overview.demo':'ДЕМО','overview.normal':'Без перегрузки',
    'process.eyebrow':'ПРОЦЕСС / ЖИВОЙ МАРШРУТ','process.title':'Каждому понятно, что делать дальше','process.sub':'Один объект хранит статус, ответственного, срок, заметку и всю историю.','process.active':'В РАБОТЕ','process.card':'КАРТОЧКА ПРОЦЕССА','process.example':'Запуск новой услуги','process.priority':'ПРИОРИТЕТ · ОБЫЧНЫЙ','process.owner':'Ответственный','process.person':'Анна · Координатор','process.deadline':'Срок','process.date':'26 июля','process.source':'Источник','process.form':'Форма на сайте','process.h1':'Запрос получен','process.h2':'Ответственный назначен','process.h3':'Материалы на согласовании','process.now':'СЕЙЧАС','process.next':'СЛЕДУЮЩИЙ ШАГ','process.nextValue':'Получить подтверждение условий','process.open':'Открыть карточку','process.r1':'Новый','process.r1s':'зафиксирован','process.r2':'В работе','process.r2s':'есть владелец','process.r3':'Согласование','process.r3s':'ожидает решения','process.r4':'Готово','process.r4s':'результат сохранён',
    'knowledge.eyebrow':'AI / КОНТЕКСТ КОМПАНИИ','knowledge.title':'AI понимает задачу, а не только вопрос','knowledge.sub':'Ищет в разрешённых данных, собирает сводку, проверяет риски и предлагает действие.','knowledge.safe':'ДОСТУП ПО РОЛЯМ','knowledge.request':'ЗАПРОС','knowledge.query':'Собери сводку по проекту и найди риски','knowledge.docs':'Документов','knowledge.events':'События истории','knowledge.rules':'Правил процесса','knowledge.result':'КРАТКИЙ ВЫВОД','knowledge.summary':'Срок зависит от согласования приложения. В карточке не назначен владелец финальной проверки.','knowledge.action':'Следующий шаг: запросить подтверждение до 16:00','knowledge.a1':'Найти в базе','knowledge.a1s':'по документам и истории','knowledge.a2':'Проверить данные','knowledge.a2s':'на пропуски и расхождения','knowledge.a3':'Подготовить действие','knowledge.a3s':'сохранить результат в процессе',
    'integrations.eyebrow':'ИНТЕГРАЦИИ / ЕДИНЫЙ КОНТУР','integrations.title':'Подключается к тому, что уже есть','integrations.sub':'Облачные сервисы, формы, базы и локальные файлы остаются источниками, а Nexus связывает их с процессом.','integrations.mode':'ОБЛАКО + LOCAL NODE','integrations.core':'РАБОЧИЙ ПРОЦЕСС','integrations.s1':'Таблицы','integrations.s2':'Формы','integrations.s3':'CRM / ERP','integrations.s4':'Локальные файлы','integrations.s5':'Почта и чаты','integrations.log1':'Источники синхронизированы','integrations.log2':'Закрытые данные доступны только по роли','integrations.now':'СЕЙЧАС',
    'system.title':'Источников много.<br><em>Процесс один.</em>','system.lede':'Nexus не заменяет всё вокруг. Он связывает нужные данные с рабочей логикой компании и показывает команде единое состояние задачи.',
    'compare.before':'ИСТОЧНИКИ КОМПАНИИ','compare.tables':'Таблицы','compare.chats':'Чаты и почта','compare.forms':'Формы','compare.docs':'Документы','compare.services':'Сервисы','compare.after':'ЕДИНЫЙ РАБОЧИЙ ОБЪЕКТ','compare.active':'В РАБОТЕ','compare.object':'Запрос на изменение условий','compare.owner':'Ответственный','compare.ownerValue':'Координатор проекта','compare.deadline':'Срок','compare.deadlineValue':'Сегодня · 16:00','compare.step1':'Получено','compare.step2':'Проверено','compare.step3':'Согласование','compare.step4':'Готово','compare.next':'СЛЕДУЮЩЕЕ ДЕЙСТВИЕ','compare.nextValue':'Подтвердить обновлённый документ','compare.history':'История и вложения сохранены',
    'system.c1label':'ВАШ РАБОЧИЙ МАРШРУТ','system.c1t':'Интерфейс повторяет реальную работу','system.c1d':'Названия, роли, этапы и правила остаются знакомыми команде. Меняется только одно: теперь ничего не теряется между людьми и сервисами.','system.route':'МАРШРУТ ПРОЦЕССА','system.b1':'Поступило','system.b1s':'из любого канала','system.b2':'В работе','system.b2s':'владелец и срок','system.b3':'Решение','system.b3s':'проверка и согласование','system.b4':'Результат','system.b4s':'история сохранена','system.c2label':'AI И ЗНАНИЯ','system.c2t':'AI работает в контексте задачи','system.c2d':'Собирает сводку, находит сведения, проверяет данные и предлагает следующий шаг прямо в рабочем объекте.','system.ai1':'Найти','system.ai2':'Проверить','system.ai3':'Подготовить','system.c3label':'КОНТРОЛЬ','system.c3t':'Состояние видно без ручного отчёта','system.c3d':'Сроки, загрузка, расход AI, ошибки интеграций и история действий остаются в одной наблюдаемой системе.',
    'worlds.title':'Один Nexus.<br><em>Ваша логика внутри.</em>','worlds.lede':'Состав модулей меняется от компании к компании. Не меняется только ясность: что происходит, кто отвечает и что дальше.','worlds.tab1':'Рабочий процесс','worlds.tab2':'AI и знания','worlds.tab3':'Интеграции','worlds.label1':'ПРОЦЕСС / ЕЖЕДНЕВНАЯ РАБОТА','worlds.w1t':'Любой маршрут становится наглядным','worlds.w1d':'Заявка, документ, заказ, проект или внутренняя задача проходят именно те этапы, которые приняты в компании.','worlds.w1a':'Свои сущности и этапы','worlds.w1b':'Роли и ручные статусы','worlds.w1c':'Сроки, заметки и история','worlds.board':'Рабочая очередь','worlds.task1':'Запрос клиента','worlds.note1':'уточнить условия','worlds.task2':'Новый сотрудник','worlds.note2':'выдать доступы','worlds.task3':'Договор','worlds.note3':'проверка версии','worlds.today':'СЕГОДНЯ','worlds.task4':'План закупки','worlds.note4':'назначен владелец','worlds.task5':'Отчёт отдела','worlds.note5':'ждёт подтверждения','worlds.task6':'Обновление сайта','worlds.note6':'финальная проверка','worlds.label2':'AI / КОНТЕКСТ И РЕШЕНИЯ','worlds.w2t':'AI встроен туда, где возникает вопрос','worlds.w2d':'Он работает с разрешёнными документами, событиями и правилами процесса, а результат возвращает в карточку задачи.','worlds.w2a':'Поиск по знаниям','worlds.w2b':'Сводки и проверка','worlds.w2c':'Подготовка следующего шага','worlds.source1':'Документы','worlds.source2':'История','worlds.source3':'Правила','worlds.i1':'Найдены связанные материалы<small>ПОИСК ПО КОНТЕКСТУ</small>','worlds.i2':'Срок расходится с документом<small>ПРОВЕРКА ДАННЫХ</small>','worlds.i3':'Следующий шаг подготовлен<small>ДЕЙСТВИЕ В ПРОЦЕССЕ</small>','worlds.label3':'ИНТЕГРАЦИИ / НУЖНЫЕ ИСТОЧНИКИ','worlds.w3t':'Nexus связывает, а не заставляет переезжать','worlds.w3d':'Сайт, CRM, ERP, почта, API и локальные файлы подключаются по задаче. Закрытые данные могут оставаться внутри компании.','worlds.w3a':'Облачные коннекторы','worlds.w3b':'Local Node для закрытого контура','worlds.w3c':'Версии и состояние подключений','worlds.hub':'NEXUS HUB','worlds.ops1':'РОЛИ · ВЕРСИИ · СОСТОЯНИЕ','worlds.sources':'ИСТОЧНИКИ','worlds.ops2':'CRM · ERP · ФАЙЛЫ · API','worlds.job1':'Данные синхронизированы','worlds.now':'СЕЙЧАС','worlds.job2':'Версия подключения подтверждена','worlds.job3':'Закрытый источник',
    'deploy.title':'Данные работают там,<br><em>где им безопаснее.</em>','deploy.lede':'Способ размещения выбирается по процессу и чувствительности данных. Локальная часть, облако или гибрид могут работать как один продукт.','deploy.localLabel':'ЛОКАЛЬНЫЙ УЗЕЛ','deploy.locald':'Закрытые операции и файлы остаются локально. Nexus управляет доступом, конфигурацией и версиями.','deploy.cost':'Серверная часть','deploy.lower':'Минимальная','deploy.best':'ГИБКИЙ ВАРИАНТ','deploy.hybridLabel':'ГИБРИДНЫЙ КОНТУР','deploy.hybridd':'Команда работает через облачный интерфейс, а чувствительные файлы и локальные системы остаются внутри компании.','deploy.scale':'Подключения','deploy.flex':'По задаче','deploy.planned':'ПЛАНИРУЕТСЯ','deploy.cloudLabel':'УПРАВЛЯЕМОЕ ОБЛАКО','deploy.cloudd':'Планируемый вариант с изолированным серверным контуром, мониторингом, резервированием и обновлениями.','deploy.maint':'Статус','deploy.roadmap':'В плане',
    'portal.lede':'В кабинете видны доступные контуры, версии, лимиты, состояние подключений и поддержка. Каждый сотрудник получает только разрешённые ему продукты.','portal.name':'Кабинет компании','portal.usage':'AI-ЛИМИТА','portal.product1':'Рабочий процесс','portal.product2':'AI и знания','portal.product3':'Интеграции','portal.sources':'5 источников','portal.renewal':'Условия продления','portal.byplan':'ПО ПЛАНУ'
  });
  Object.assign(translations.en, {
    'hero.kicker':'NEXUS / A PERSONAL BUSINESS SYSTEM','hero.title':'Your process.<br><em>Built into Nexus.</em>','hero.lede':'Not another off-the-shelf CRM. We turn the logic of your company into one workspace with the right statuses, AI and integrations.','hero.layer1':'Work process','hero.layer2':'AI and knowledge','hero.layer3':'Integrations','hero.status1':'SHAPED AROUND YOUR LOGIC','hero.status2':'INSIDE THE TASK','hero.status3':'CLOUD + LOCAL DATA',
    'sat.request':'Status updated','sat.requestSub':'NEXT STEP ASSIGNED','sat.checked':'Document checked','sat.checkedSub':'TIMELINE RISK FOUND','sat.connected':'Source connected','sat.connectedSub':'FORM → WORK PROCESS','sat.control':'Usage under control','sat.usage':'LIMIT AND FORECAST VISIBLE',
    'demo.window':'NEXUS / COMPANY WORK ENVIRONMENT','demo.process':'Process','demo.knowledge':'AI and knowledge','demo.integrations':'Integrations',
    'rail.processes':'PROCESSES','rail.requests':'REQUESTS','rail.documents':'DOCUMENTS','rail.approvals':'APPROVALS','rail.knowledge':'KNOWLEDGE','rail.integrations':'INTEGRATIONS','rail.analytics':'ANALYTICS',
    'overview.eyebrow':'OVERVIEW / DEMO','overview.title':'Your workday in one environment','overview.sub':'Processes, people and important events form one clear picture.','overview.m1':'Active processes','overview.m1s':'all assigned','overview.m2':'Completed on time','overview.m2s':'this week','overview.m3':'AI limit','overview.m3s':'forecast on track','overview.products':'Work environments','overview.requests':'Requests','overview.requestsSub':'New · Active · Resolved','overview.projects':'Projects','overview.projectsSub':'Stages · Team · Budget','overview.docs':'Documents','overview.docsSub':'Review · Approval · Archive','overview.integrations':'Integrations','overview.integrationsSub':'Website · CRM · Local data','overview.activity':'Process rhythm','overview.demo':'DEMO','overview.normal':'No overload',
    'process.eyebrow':'PROCESS / LIVE ROUTE','process.title':'Everyone knows what happens next','process.sub':'One object keeps the status, owner, deadline, note and complete history.','process.active':'IN PROGRESS','process.card':'PROCESS CARD','process.example':'Launch a new service','process.priority':'PRIORITY · NORMAL','process.owner':'Owner','process.person':'Anna · Coordinator','process.deadline':'Deadline','process.date':'July 26','process.source':'Source','process.form':'Website form','process.h1':'Request received','process.h2':'Owner assigned','process.h3':'Materials under approval','process.now':'NOW','process.next':'NEXT STEP','process.nextValue':'Receive terms confirmation','process.open':'Open card','process.r1':'New','process.r1s':'captured','process.r2':'In progress','process.r2s':'owner assigned','process.r3':'Approval','process.r3s':'waiting for decision','process.r4':'Done','process.r4s':'result saved',
    'knowledge.eyebrow':'AI / COMPANY CONTEXT','knowledge.title':'AI understands the task, not just the question','knowledge.sub':'It searches allowed data, builds a summary, checks risks and suggests an action.','knowledge.safe':'ROLE-BASED ACCESS','knowledge.request':'REQUEST','knowledge.query':'Summarize the project and identify risks','knowledge.docs':'Documents','knowledge.events':'History events','knowledge.rules':'Process rules','knowledge.result':'SHORT SUMMARY','knowledge.summary':'The deadline depends on appendix approval. The final review owner is missing from the card.','knowledge.action':'Next step: request confirmation before 4 PM','knowledge.a1':'Search knowledge','knowledge.a1s':'across documents and history','knowledge.a2':'Check data','knowledge.a2s':'for gaps and conflicts','knowledge.a3':'Prepare action','knowledge.a3s':'save the result in the process',
    'integrations.eyebrow':'INTEGRATIONS / ONE ENVIRONMENT','integrations.title':'Connect what you already use','integrations.sub':'Cloud services, forms, databases and local files remain sources while Nexus connects them to the process.','integrations.mode':'CLOUD + LOCAL NODE','integrations.core':'WORK PROCESS','integrations.s1':'Spreadsheets','integrations.s2':'Forms','integrations.s3':'CRM / ERP','integrations.s4':'Local files','integrations.s5':'Email and chats','integrations.log1':'Sources synchronized','integrations.log2':'Sensitive data available by role only','integrations.now':'NOW',
    'system.title':'Many sources.<br><em>One process.</em>','system.lede':'Nexus does not replace everything around it. It connects the data you need with the company workflow and gives the team one shared state.','compare.before':'COMPANY SOURCES','compare.tables':'Spreadsheets','compare.chats':'Chats and email','compare.forms':'Forms','compare.docs':'Documents','compare.services':'Services','compare.after':'ONE WORK OBJECT','compare.active':'IN PROGRESS','compare.object':'Request to update terms','compare.owner':'Owner','compare.ownerValue':'Project coordinator','compare.deadline':'Deadline','compare.deadlineValue':'Today · 4 PM','compare.step1':'Received','compare.step2':'Checked','compare.step3':'Approval','compare.step4':'Done','compare.next':'NEXT ACTION','compare.nextValue':'Approve the updated document','compare.history':'History and files are saved',
    'system.c1label':'YOUR WORK ROUTE','system.c1t':'The interface mirrors real work','system.c1d':'Names, roles, stages and rules stay familiar to the team. The difference is that nothing gets lost between people and services.','system.route':'PROCESS ROUTE','system.b1':'Received','system.b1s':'from any channel','system.b2':'In progress','system.b2s':'owner and deadline','system.b3':'Decision','system.b3s':'review and approval','system.b4':'Result','system.b4s':'history saved','system.c2label':'AI AND KNOWLEDGE','system.c2t':'AI works in task context','system.c2d':'It builds summaries, finds facts, checks data and suggests the next step inside the work object.','system.ai1':'Find','system.ai2':'Check','system.ai3':'Prepare','system.c3label':'CONTROL','system.c3t':'See the state without a manual report','system.c3d':'Deadlines, load, AI spend, integration errors and action history stay in one observable system.',
    'worlds.title':'One Nexus.<br><em>Your logic inside.</em>','worlds.lede':'Modules change from one company to another. Clarity does not: what is happening, who owns it and what comes next.','worlds.tab1':'Work process','worlds.tab2':'AI and knowledge','worlds.tab3':'Integrations','worlds.label1':'PROCESS / DAILY WORK','worlds.w1t':'Any route becomes easy to follow','worlds.w1d':'A request, document, order, project or internal task moves through the exact stages used by the company.','worlds.w1a':'Custom objects and stages','worlds.w1b':'Roles and manual statuses','worlds.w1c':'Deadlines, notes and history','worlds.board':'Work queue','worlds.task1':'Customer request','worlds.note1':'clarify the terms','worlds.task2':'New teammate','worlds.note2':'grant access','worlds.task3':'Contract','worlds.note3':'review the version','worlds.today':'TODAY','worlds.task4':'Purchase plan','worlds.note4':'owner assigned','worlds.task5':'Team report','worlds.note5':'awaiting approval','worlds.task6':'Website update','worlds.note6':'final review','worlds.label2':'AI / CONTEXT AND DECISIONS','worlds.w2t':'AI appears where the question happens','worlds.w2d':'It works with allowed documents, events and process rules, then returns the result to the task card.','worlds.w2a':'Knowledge search','worlds.w2b':'Summaries and checks','worlds.w2c':'Next-step preparation','worlds.source1':'Documents','worlds.source2':'History','worlds.source3':'Rules','worlds.i1':'Related materials found<small>CONTEXT SEARCH</small>','worlds.i2':'Deadline conflicts with document<small>DATA CHECK</small>','worlds.i3':'Next step prepared<small>PROCESS ACTION</small>','worlds.label3':'INTEGRATIONS / THE RIGHT SOURCES','worlds.w3t':'Nexus connects instead of forcing migration','worlds.w3d':'Website, CRM, ERP, email, APIs and local files connect as needed. Sensitive data can stay inside the company.','worlds.w3a':'Cloud connectors','worlds.w3b':'Local Node for sensitive data','worlds.w3c':'Connection versions and health','worlds.hub':'NEXUS HUB','worlds.ops1':'ROLES · VERSIONS · HEALTH','worlds.sources':'SOURCES','worlds.ops2':'CRM · ERP · FILES · API','worlds.job1':'Data synchronized','worlds.now':'NOW','worlds.job2':'Connection version verified','worlds.job3':'Sensitive source',
    'deploy.title':'Data runs where<br><em>it stays safer.</em>','deploy.lede':'Deployment follows the process and data sensitivity. Local, cloud or hybrid layers can work as one product.','deploy.localLabel':'LOCAL NODE','deploy.locald':'Sensitive operations and files stay local. Nexus controls access, configuration and versions.','deploy.cost':'Server layer','deploy.lower':'Minimal','deploy.best':'FLEXIBLE OPTION','deploy.hybridLabel':'HYBRID ENVIRONMENT','deploy.hybridd':'The team works through the cloud interface while sensitive files and local systems remain inside the company.','deploy.scale':'Connections','deploy.flex':'As needed','deploy.planned':'PLANNED','deploy.cloudLabel':'MANAGED CLOUD','deploy.cloudd':'A planned option with an isolated server environment, monitoring, backups and managed updates.','deploy.maint':'Status','deploy.roadmap':'Roadmap',
    'portal.lede':'The account shows available environments, versions, limits, connection health and support. Each teammate sees only permitted products.','portal.name':'Company account','portal.usage':'AI LIMIT','portal.product1':'Work process','portal.product2':'AI and knowledge','portal.product3':'Integrations','portal.sources':'5 sources','portal.renewal':'Renewal terms','portal.byplan':'BY PLAN'
  });
  Object.assign(translations.ru, {
    'updates.titleCompact':'История изменений','updates.ledeCompact':'Коротко о том, что уже изменилось на сайте, и что пока находится только в плане продукта.','updates.back':'К продукту','updates.current':'ТЕКУЩАЯ ВЕРСИЯ САЙТА','updates.note':'Версии ниже относятся к публичной витрине. Функции платформы отдельно отмечены как запланированные.','updates.toPlan':'Перейти к планам ↓','updates.released':'ВЫПУЩЕНО','updates.changed':'ИЗМЕНЕНО','updates.added':'ДОБАВЛЕНО','updates.fixed':'ИСПРАВЛЕНО','updates.planned':'ЗАПЛАНИРОВАНО','updates.v050t':'Универсальная презентация Nexus','updates.v050a':'Звонки и 1С больше не выглядят стандартным наполнением каждого workspace.','updates.v050b':'Новые сцены «Процесс», «AI и знания» и «Интеграции».','updates.v050c':'Увеличены ключевые подписи и переработана мобильная компоновка.','updates.v050d':'История обновлений стала компактным changelog.','updates.v040t':'Первая публичная витрина','updates.v040a':'Русская и английская версии сайта.','updates.v040b':'Интерактивная демонстрация интерфейса Nexus.','updates.v040c':'Отдельные страницы доступа, кабинета и обновлений.','updates.noDate':'БЕЗ ДАТЫ РЕЛИЗА','updates.nextt':'Следующие этапы продукта','updates.nexta':'Публичный подписанный Windows-релиз с защищённой выдачей и обновлениями.','updates.nextb':'Настоящий вход по приглашению и клиентский кабинет.','updates.nextc':'Managed Cloud с изолированным контуром, мониторингом и резервированием.'
  });
  Object.assign(translations.en, {
    'updates.titleCompact':'Changelog','updates.ledeCompact':'A concise record of what has changed on the website and what still exists only in the product roadmap.','updates.back':'Back to product','updates.current':'CURRENT WEBSITE VERSION','updates.note':'The versions below refer to the public website. Platform capabilities are marked separately when they are only planned.','updates.toPlan':'Jump to roadmap ↓','updates.released':'RELEASED','updates.changed':'CHANGED','updates.added':'ADDED','updates.fixed':'FIXED','updates.planned':'PLANNED','updates.v050t':'A universal Nexus presentation','updates.v050a':'Calls and ERP no longer look like the default content of every workspace.','updates.v050b':'New Process, AI and Knowledge, and Integrations scenes.','updates.v050c':'Key labels are larger and the mobile layout has been rebuilt.','updates.v050d':'The updates page is now a compact changelog.','updates.v040t':'First public product website','updates.v040a':'Russian and English website versions.','updates.v040b':'Interactive Nexus interface demonstration.','updates.v040c':'Separate Access, Account and Updates pages.','updates.noDate':'NO RELEASE DATE','updates.nextt':'Next product stages','updates.nexta':'A public signed Windows release with protected delivery and updates.','updates.nextb':'Real invite-only authentication and client account.','updates.nextc':'Managed Cloud with an isolated environment, monitoring and backups.'
  });
  Object.assign(translations.ru, {
    'aria.mainNav':'Главная навигация','aria.language':'Сменить язык','aria.menu':'Открыть меню','aria.capabilities':'Ключевые возможности Nexus','aria.demoTabs':'Разделы демонстрации Nexus','aria.signalRail':'Возможности Nexus','aria.worldTabs':'Сценарии Nexus','aria.changelog':'История версий','aria.processRoute':'Маршрут процесса',
    'meta.homeDescription':'Vertux Nexus превращает разрозненные процессы, данные и сервисы компании в персональную рабочую систему.','meta.homeTitle':'Vertux Nexus - ваш процесс, собранный в систему','meta.homeOgDescription':'Индивидуальный рабочий контур с понятными статусами, AI в контексте задач и нужными интеграциями.','meta.accountDescription':'Безопасный вход в Vertux Nexus по приглашению.','meta.downloadDescription':'Страница будущего установщика Vertux Nexus для Windows и веб-доступа.','meta.updatesDescription':'Краткая история изменений сайта и будущие этапы Vertux Nexus.',
    'sections.system':'01 / СИСТЕМА','sections.product':'02 / ПРОДУКТ','sections.deployment':'03 / РАЗМЕЩЕНИЕ','sections.portal':'04 / КАБИНЕТ',
    'hero.note':'ДОСТУП ПО ПРИГЛАШЕНИЮ · WINDOWS + ВЕБ · УПРАВЛЯЕМОЕ ОБСЛУЖИВАНИЕ','demo.role':'ДОСТУП ВЛАДЕЛЬЦА','status.online':'В СЕТИ','integrations.mode':'ОБЛАКО + ЛОКАЛЬНЫЙ УЗЕЛ',
    'micro.secure':'ЗАЩИЩЕНО','micro.messages':'СООБЩЕНИЯ','micro.status':'СТАТУС','micro.onTrack':'В НОРМЕ','micro.ready':'ГОТОВО','micro.local':'ЛОКАЛЬНО',
    'worlds.filesCount':'18 ФАЙЛОВ','worlds.eventsCount':'42 СОБЫТИЯ','worlds.rulesCount':'07 ПРАВИЛ','worlds.hub':'ЦЕНТР NEXUS','worlds.review':'СОГЛАСОВАНИЕ','worlds.w1t':'Каждый этап виден. Следующий шаг не теряется.','process.open':'КАРТОЧКА ПРОЦЕССА',
    'account.formkicker':'ЗАЩИЩЁННЫЙ ВХОД','account.formtitle':'Открыть Vertux Nexus','account.formlede':'Авторизация, восстановление доступа и принятие приглашений выполняются в едином защищённом приложении Nexus.','account.liveNotice':'Эта страница не принимает email или пароль. Данные вводятся только на защищённом домене Nexus.','account.open':'ОТКРЫТЬ NEXUS','account.windows':'Скачать приложение для Windows','account.help':'Нет приглашения или нужна помощь?','account.contact':'Написать в Vertux',
    'updates.v050a':'Узкие клиентские сценарии больше не выглядят стандартным наполнением каждой системы.'
  });
  Object.assign(translations.en, {
    'aria.mainNav':'Main navigation','aria.language':'Switch language','aria.menu':'Open menu','aria.capabilities':'Key Nexus capabilities','aria.demoTabs':'Nexus demo sections','aria.signalRail':'Nexus capabilities','aria.worldTabs':'Nexus scenarios','aria.changelog':'Version history','aria.processRoute':'Process route',
    'meta.homeDescription':'Vertux Nexus turns scattered processes, data and services into a personal business system.','meta.homeTitle':'Vertux Nexus - your process, built into a system','meta.homeOgDescription':'A tailored work environment with clear statuses, contextual AI and the integrations your company needs.','meta.accountDescription':'Secure invite-only access to Vertux Nexus.','meta.downloadDescription':'Preview of the upcoming Vertux Nexus installer for Windows and web access.','meta.updatesDescription':'A concise history of website changes and upcoming Vertux Nexus product stages.',
    'sections.system':'01 / SYSTEM','sections.product':'02 / PRODUCT','sections.deployment':'03 / DEPLOYMENT','sections.portal':'04 / ACCOUNT',
    'hero.note':'INVITE-ONLY ACCESS · WINDOWS + WEB · MANAGED SUPPORT','demo.role':'OWNER ACCESS','status.online':'ONLINE','integrations.mode':'CLOUD + LOCAL NODE',
    'micro.secure':'SECURE','micro.messages':'MESSAGES','micro.status':'STATUS','micro.onTrack':'ON TRACK','micro.ready':'READY','micro.local':'LOCAL',
    'worlds.filesCount':'18 FILES','worlds.eventsCount':'42 EVENTS','worlds.rulesCount':'07 RULES','worlds.hub':'NEXUS HUB','worlds.review':'APPROVAL','worlds.w1t':'Every stage is visible. The next step stays clear.','process.open':'PROCESS CARD',
    'account.formkicker':'SECURE SIGN-IN','account.formtitle':'Open Vertux Nexus','account.formlede':'Sign-in, account recovery and invitation acceptance are handled in the single protected Nexus application.','account.liveNotice':'This page never accepts an email or password. Enter credentials only on the protected Nexus domain.','account.open':'OPEN NEXUS','account.windows':'Download the Windows app','account.help':'No invitation or need help?','account.contact':'Contact Vertux',
    'updates.v050a':'Narrow client-specific scenarios no longer look like the default content of every system.'
  });
  Object.assign(translations.ru, {
    'download.testBuild':'TEST BUILD / X64',
    'download.gateKicker':'ВРЕМЕННЫЙ ДОСТУП',
    'download.gateTitle':'Скачать по коду',
    'download.serverCheck':'ПРОВЕРКА СЕРВЕРОМ',
    'download.codeLabel':'Код доступа Vertux',
    'download.codeHint':'Код не хранится на сайте и отправляется только в защищённый сервис выдачи.',
    'download.showCode':'Показать',
    'download.hideCode':'Скрыть',
    'download.showCodeAria':'Показать код доступа',
    'download.hideCodeAria':'Скрыть код доступа',
    'download.downloadButton':'Скачать Windows-версию',
    'download.requestCode':'Нет кода? Запросить тестовый доступ',
    'download.gateUnconfigured':'Защищённая выдача ещё подключается. Пока установщик не публикуется в открытом доступе.',
    'download.gateReady':'Введите выданный код. После серверной проверки откроется одноразовая ссылка.',
    'download.gateEmpty':'Введите код доступа.',
    'download.gateRequesting':'Проверяем код и готовим одноразовую ссылку…',
    'download.gateInvalid':'Код не подошёл или уже отозван. Проверьте ввод.',
    'download.gateLimited':'Слишком много попыток. Подождите и попробуйте позже.',
    'download.gateUnavailable':'Сервис выдачи временно недоступен. Установщик не был раскрыт.',
    'download.gateInvalidResponse':'Сервер не выдал безопасный короткоживущий ticket. Загрузка остановлена.',
    'download.gateSuccess':'Код принят. Одноразовая загрузка началась.',
    'meta.downloadDescription':'Защищённая выдача тестовой Windows-версии Vertux Nexus и информация о Web Access.'
  });
  Object.assign(translations.en, {
    'download.testBuild':'TEST BUILD / X64',
    'download.gateKicker':'TEMPORARY ACCESS',
    'download.gateTitle':'Download with a code',
    'download.serverCheck':'SERVER CHECK',
    'download.codeLabel':'Vertux access code',
    'download.codeHint':'The code is not stored on this website and is sent only to the secure delivery service.',
    'download.showCode':'Show',
    'download.hideCode':'Hide',
    'download.showCodeAria':'Show access code',
    'download.hideCodeAria':'Hide access code',
    'download.downloadButton':'Download for Windows',
    'download.requestCode':'No code? Request test access',
    'download.gateUnconfigured':'Secure delivery is still being connected. The installer is not published openly.',
    'download.gateReady':'Enter your issued code. A one-time link will open after server verification.',
    'download.gateEmpty':'Enter an access code.',
    'download.gateRequesting':'Checking the code and preparing a one-time link…',
    'download.gateInvalid':'The code is incorrect or has been revoked. Check your entry.',
    'download.gateLimited':'Too many attempts. Wait before trying again.',
    'download.gateUnavailable':'The delivery service is temporarily unavailable. The installer was not exposed.',
    'download.gateInvalidResponse':'The server did not issue a safe short-lived ticket. Download stopped.',
    'download.gateSuccess':'Code accepted. The one-time download has started.',
    'meta.downloadDescription':'Secure delivery of the Vertux Nexus Windows test build and Web Access information.'
  });
  translations.ru['calls.added'] = 'Добавлено в заметку ✓';
  translations.en['calls.added'] = 'Added to note ✓';

  // Public landing: the standard Invest edition is a preview, not an active offer.
  Object.assign(translations.ru, {
    'meta.homeDescription':'Рабочие пространства Vertux Nexus: системы под задачи бизнеса и Invest Workspace для личного портфеля. Готовим подписку Invest от 1 490 ₽ в месяц.',
    'meta.homeTitle':'Vertux Nexus — рабочие пространства для бизнеса и инвестиций',
    'meta.homeOgDescription':'Индивидуальные Workspace для компаний и Invest Workspace для инвестора. Возможности, интерфейс и условия будущего запуска.',
    'nav.business':'Для бизнеса', 'nav.platform':'Платформа',
    'hero.title':'Ваши задачи.<br><em>Собраны в Nexus.</em>',
    'hero.lede':'Рабочие пространства для бизнеса и личных инвестиций. Создаём системы под процессы компаний и готовим Invest Workspace к запуску по подписке.',
    'hero.primary':'Изучить Invest Workspace', 'hero.secondary':'Workspace для бизнеса',
    'hero.note':'Одна платформа. Разные задачи. Свой Workspace.',
    'invest.status':'Готовим к запуску', 'invest.title':'Весь портфель.<br><em>В поле зрения.</em>',
    'invest.lede':'Личное рабочее пространство инвестора: история операций, аналитика и план действий рядом. Единый продукт со своим счётом и настройками.',
    'invest.f1title':'Понимать результат',
    'invest.f1body':'Стоимость портфеля, история операций, комиссии и динамика за выбранный период.',
    'invest.f2title':'Держать план перед глазами',
    'invest.f2body':'Инструменты, календарь, напоминания и торговый план в одном рабочем пространстве.',
    'invest.f3title':'Работать со своими данными',
    'invest.f3body':'Портфель и ключ брокера хранятся на вашем Windows-компьютере. Подключение работает в режиме просмотра.',
    'invest.previewAria':'Открыть скриншот Invest Workspace крупнее',
    'invest.previewAlt':'Invest Workspace: обзор портфеля, кривая капитала и операции на учебных данных',
    'invest.previewNote':'Интерфейс приложения · учебные данные', 'invest.previewOpen':'Открыть крупнее',
    'invest.planTitle':'Один план. Выбираете срок.',
    'invest.planBody':'Планируемая подписка с одинаковыми возможностями на месяц, три месяца или год.',
    'invest.month':'1 месяц', 'invest.quarter':'3 месяца', 'invest.year':'1 год',
    'invest.monthRate':'1 490 ₽ / месяц', 'invest.quarterRate':'1 330 ₽ / месяц', 'invest.yearRate':'≈ 1 242 ₽ / месяц',
    'invest.launchNote':'Продажи ещё не открыты. Условия на 3 месяца и год предварительные; дату запуска и состав AI-функций сообщим отдельно.',
    'invest.contact':'Обсудить ранний доступ',
    'invest.q1':'Какие брокеры будут поддерживаться?',
    'invest.a1':'Первую версию готовим с подключением к Т-Инвестициям для просмотра данных своего счёта. Интеграции с другими брокерами исследуем; готовых подключений к ним пока нет.',
    'invest.q2':'Что с AI-анализом и пробным периодом?',
    'invest.a2':'Планируем анализ компаний, работу с новостями и 30-дневный пробный период. Сейчас выбираем AI-провайдера и лимиты: эти функции и пробный доступ ещё не запущены.',
    'invest.q3':'Можно ли пользоваться с телефона?',
    'invest.a3':'Первую версию готовим для Windows. Общий облачный портфель и доступ к нему с телефона пока не входят в заявленные возможности.',
    'business.title':'Workspace по логике<br><em>вашей компании.</em>',
    'business.lede':'Для задач бизнеса создаём индивидуальные системы: ваши процессы, роли и интеграции. Состав, стоимость и сопровождение определяем после знакомства с задачей.',
    'business.contact':'Обсудить задачу',
    'demo.caption':'Пример Workspace для бизнеса · выберите раздел внутри интерфейса',
    'footer.homeNote':'Рабочие пространства для бизнеса и личных инвестиций.'
  });
  Object.assign(translations.en, {
    'meta.homeDescription':'Vertux Nexus workspaces: custom business systems and Invest Workspace for your portfolio. Preparing an Invest subscription from RUB 1,490 per month.',
    'meta.homeTitle':'Vertux Nexus — workspaces for business and investing',
    'meta.homeOgDescription':'Custom workspaces for companies and Invest Workspace for individual investors. Features, interface and planned launch terms.',
    'nav.business':'For business', 'nav.platform':'Platform',
    'hero.title':'Your work.<br><em>Together in Nexus.</em>',
    'hero.lede':'Workspaces for business and personal investing. We build systems around company processes and are preparing Invest Workspace for a subscription launch.',
    'hero.primary':'Explore Invest Workspace', 'hero.secondary':'A workspace for business',
    'hero.note':'One platform. Different needs. Your own workspace.',
    'invest.status':'Preparing for launch', 'invest.title':'Your portfolio.<br><em>A clearer view.</em>',
    'invest.lede':'A personal workspace for investors: transaction history, analytics and your action plan, side by side. A shared product with your own account and settings.',
    'invest.f1title':'Understand the result',
    'invest.f1body':'Portfolio value, transaction history, fees and performance over a selected period.',
    'invest.f2title':'Keep your plan in view',
    'invest.f2body':'Instruments, a calendar, reminders and a trading plan in one workspace.',
    'invest.f3title':'Work with your own data',
    'invest.f3body':'Your portfolio and broker key stay on your Windows computer. The connection is read-only.',
    'invest.previewAria':'Open a larger Invest Workspace screenshot',
    'invest.previewAlt':'Invest Workspace portfolio overview, equity chart and transactions using sample data; interface shown in Russian',
    'invest.previewNote':'App interface in Russian · sample data', 'invest.previewOpen':'View larger',
    'invest.planTitle':'One plan. Choose the duration.',
    'invest.planBody':'A planned subscription with the same features for one month, three months or a year.',
    'invest.month':'1 month', 'invest.quarter':'3 months', 'invest.year':'1 year',
    'invest.monthRate':'RUB 1,490 / month', 'invest.quarterRate':'RUB 1,330 / month', 'invest.yearRate':'≈ RUB 1,242 / month',
    'invest.launchNote':'Sales are not open yet. Quarterly and annual terms are provisional; we will announce the launch date and AI features separately.',
    'invest.contact':'Discuss early access',
    'invest.q1':'Which brokers will be supported?',
    'invest.a1':'We are preparing the first version with a read-only T-Invest connection for your own account. We are researching other brokers; those connections are not available yet.',
    'invest.q2':'What about AI analysis and a trial?',
    'invest.a2':'Company analysis, news features and a 30-day trial are planned. We are selecting an AI provider and usage limits; these features and the trial have not launched yet.',
    'invest.q3':'Can I use it on my phone?',
    'invest.a3':'The first version is being prepared for Windows. A shared cloud portfolio and mobile access are not part of the announced features yet.',
    'business.title':'A workspace built<br><em>around your company.</em>',
    'business.lede':'For business needs, we build custom systems with your processes, roles and integrations. Scope, pricing and support are agreed after we discuss your needs.',
    'business.contact':'Discuss your project',
    'demo.caption':'Example business workspace · choose a section inside the interface',
    'footer.homeNote':'Workspaces for business and personal investing.'
  });

  Object.assign(translations.ru, {
    'tour.try':'Попробовать пример', 'tour.toPrice':'Рассчитать подписку',
    'tour.title':'Попробуйте на примере',
    'tour.intro':'Посмотрите, как читать портфель, находить операции и понимать, где находятся ваши данные.',
    'tour.sample':'Учебные значения', 'tour.tabsAria':'Примеры Invest Workspace',
    'tour.portfolio':'Портфель', 'tour.operations':'Операции', 'tour.data':'Где мои данные',
    'tour.portfolioTitle':'Рост суммы на счёте — ещё не прибыль',
    'tour.portfolioBody':'В начале периода было 1 000 000 ₽, в конце стало 1 240 000 ₽. Часть разницы могла появиться из-за пополнения. Измените его сумму и посмотрите, что останется после вычета внесённых денег.',
    'tour.mathNote':'Упрощённый пример: без выводов и отдельных денежных выплат. Показывает денежную разницу, а не процент доходности.',
    'tour.start':'В начале', 'tour.end':'В конце', 'tour.contribution':'Пополнения за период',
    'tour.sliderHelp':'Двигайте ползунок или используйте стрелки на клавиатуре.',
    'tour.resultLabel':'Изменение без пополнений',
    'tour.defaultResult':'200 000 ₽ внесены вами. Оставшиеся 40 000 ₽ — изменение стоимости без этого пополнения.',
    'tour.operationsTitle':'Найдите, из чего сложилась сумма',
    'tour.operationsBody':'Пополнение, покупка и комиссия означают разные вещи. Покупка меняет состав портфеля, пополнение добавляет ваши деньги, комиссия уменьшает денежный остаток.',
    'tour.operationsNote':'Это отдельная учебная история. Выберите тип, чтобы оставить только нужные операции.',
    'tour.filterAria':'Тип операций', 'tour.all':'Все', 'tour.deposits':'Пополнения', 'tour.fees':'Комиссии',
    'tour.tableCaption':'Учебная история операций', 'tour.operation':'Операция', 'tour.amount':'Сумма',
    'tour.deposit':'Пополнение', 'tour.purchase':'Покупка бумаг', 'tour.fee':'Комиссия',
    'tour.date1':'2 сентября', 'tour.date2':'3 сентября', 'tour.date3':'8 сентября', 'tour.date4':'10 сентября',
    'tour.allSummary':'Показаны все 5 операций. Сумма движений денег не равна прибыли портфеля.',
    'tour.dataTitle':'Nexus и Workspace отвечают за разное',
    'tour.dataBody':'Nexus — общий вход, доступ к продуктам и обновления. Invest Workspace — место, где вы работаете со своим инвестиционным портфелем.',
    'tour.dataNote':'Вход в Nexus с другого устройства сам по себе не переносит туда локальный портфель.',
    'tour.localTitle':'На вашем Windows-компьютере',
    'tour.localBody':'Портфель, история и ключ подключения к брокеру. Ключ вводится в защищённом системном окне.',
    'tour.nexusTitle':'В Nexus', 'tour.nexusBody':'Учётная запись, разрешённые продукты, устройства, версия приложения и сопровождение.',
    'tour.brokerTitle':'У брокера', 'tour.brokerBody':'Ваш брокерский счёт. Invest получает данные для просмотра; сделки и переводы вы совершаете у брокера.',
    'calc.choose':'Выберите срок для расчёта', 'calc.monthTotal':'Всего за 1 месяц',
    'calc.perMonth':'В пересчёте на месяц', 'calc.saving':'Экономия к оплате помесячно',
    'calc.defaultNote':'Месячный вариант без скидки за срок. Во всех вариантах одинаковые возможности.',
    'invest.q4':'Как будет устроено начало работы?',
    'invest.start1':'После открытия продаж — выбрать срок подписки и получить свой доступ к продукту.',
    'invest.start2':'Установить Nexus на Windows и открыть свой Invest Workspace.',
    'invest.start3':'Подключить свой брокерский счёт в режиме просмотра через защищённое системное окно.',
    'invest.start4':'Выполнить первую синхронизацию, проверить состав данных и настроить рабочее пространство.',
    'invest.startNote':'Сейчас самостоятельная покупка и выдача доступа ещё готовятся. Обсудить ранний доступ можно с Vertux.',
    'compare.choice':'Чем индивидуальный Workspace отличается от Invest?',
    'compare.invest':'Общий продукт для личного инвестиционного портфеля. Вы подключаете свой счёт и меняете настройки; набор возможностей развивается вместе с продуктом.',
    'compare.investPrice':'Планируемая подписка: 1 490 ₽ за месяц.', 'compare.toInvest':'Вернуться к Invest',
    'compare.businessTitle':'Workspace для компании',
    'compare.business':'Отдельный проект под ваш процесс: свои сущности, этапы, роли сотрудников и интеграции. Сначала разбираем задачу, затем согласуем состав и разработку.',
    'compare.businessPrice':'Стоимость и сопровождение рассчитываются под задачу.'
  });
  Object.assign(translations.en, {
    'tour.try':'Try an example', 'tour.toPrice':'Calculate the subscription',
    'tour.title':'Try it with an example',
    'tour.intro':'Explore how to read a portfolio, find transactions and understand where your data lives.',
    'tour.sample':'Sample values', 'tour.tabsAria':'Invest Workspace examples',
    'tour.portfolio':'Portfolio', 'tour.operations':'Transactions', 'tour.data':'Where data lives',
    'tour.portfolioTitle':'A larger account total does not always mean profit',
    'tour.portfolioBody':'The period starts at RUB 1,000,000 and ends at RUB 1,240,000. Deposits may explain part of the difference. Change the amount added to see what remains after subtracting your deposits.',
    'tour.mathNote':'Simplified example with no withdrawals or separate cash payouts. It shows a cash difference, not a rate of return.',
    'tour.start':'At the start', 'tour.end':'At the end', 'tour.contribution':'Deposits during the period',
    'tour.sliderHelp':'Move the slider or use the arrow keys.',
    'tour.resultLabel':'Change excluding deposits',
    'tour.defaultResult':'You added RUB 200,000. The remaining RUB 40,000 is the change in value excluding that deposit.',
    'tour.operationsTitle':'See what the total consists of',
    'tour.operationsBody':'Deposits, purchases and fees mean different things. A purchase changes the portfolio composition, a deposit adds your money, and a fee reduces your cash balance.',
    'tour.operationsNote':'This is a separate sample history. Choose a type to show only the transactions you need.',
    'tour.filterAria':'Transaction type', 'tour.all':'All', 'tour.deposits':'Deposits', 'tour.fees':'Fees',
    'tour.tableCaption':'Sample transaction history', 'tour.operation':'Transaction', 'tour.amount':'Amount',
    'tour.deposit':'Deposit', 'tour.purchase':'Securities purchase', 'tour.fee':'Fee',
    'tour.date1':'2 September', 'tour.date2':'3 September', 'tour.date3':'8 September', 'tour.date4':'10 September',
    'tour.allSummary':'All 5 transactions are shown. Adding cash movements together does not give portfolio profit.',
    'tour.dataTitle':'Nexus and your workspace have different roles',
    'tour.dataBody':'Nexus provides your sign-in, product access and updates. Invest Workspace is where you work with your investment portfolio.',
    'tour.dataNote':'Signing in to Nexus on another device does not automatically transfer your local portfolio to it.',
    'tour.localTitle':'On your Windows computer',
    'tour.localBody':'Your portfolio, history and broker connection key. The key is entered in a secure system window.',
    'tour.nexusTitle':'In Nexus', 'tour.nexusBody':'Your account, permitted products, devices, app version and support.',
    'tour.brokerTitle':'With your broker', 'tour.brokerBody':'Your brokerage account. Invest reads data; you place trades and make transfers with your broker.',
    'calc.choose':'Choose a duration to calculate', 'calc.monthTotal':'Total for 1 month',
    'calc.perMonth':'Monthly equivalent', 'calc.saving':'Savings compared with monthly payments',
    'calc.defaultNote':'The monthly option has no term discount. Every duration includes the same features.',
    'invest.q4':'How will getting started work?',
    'invest.start1':'Once sales open, choose a subscription duration and receive your own product access.',
    'invest.start2':'Install Nexus on Windows and open your Invest Workspace.',
    'invest.start3':'Connect your own brokerage account in read-only mode through a secure system window.',
    'invest.start4':'Run the first sync, check the available data and configure your workspace.',
    'invest.startNote':'Self-service purchasing and access provisioning are still being prepared. You can discuss early access with Vertux.',
    'compare.choice':'How is a custom workspace different from Invest?',
    'compare.invest':'A shared product for your personal investment portfolio. Connect your own account and adjust the settings; features evolve with the product.',
    'compare.investPrice':'Planned subscription: RUB 1,490 per month.', 'compare.toInvest':'Back to Invest',
    'compare.businessTitle':'A workspace for your company',
    'compare.business':'A separate project for your process: custom records, stages, team roles and integrations. We discuss your needs before agreeing the scope and development.',
    'compare.businessPrice':'Pricing and support are scoped to your project.'
  });

  var language = 'ru';
  try { language = localStorage.getItem('vertux-nexus-lang') || 'ru'; } catch (error) { language = 'ru'; }
  if (!translations[language]) language = 'ru';

  function setLanguage(next) {
    language = translations[next] ? next : 'ru';
    try { localStorage.setItem('vertux-nexus-lang', language); } catch (error) { /* Private/file contexts can block storage. */ }
    document.documentElement.lang = language;
    document.querySelectorAll('[data-i18n]').forEach(function (node) {
      var value = translations[language][node.getAttribute('data-i18n')];
      if (value != null) node.textContent = value;
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (node) {
      var value = translations[language][node.getAttribute('data-i18n-html')];
      if (value != null) node.innerHTML = value;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (node) {
      var value = translations[language][node.getAttribute('data-i18n-aria')];
      if (value != null) node.setAttribute('aria-label', value);
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (node) {
      var value = translations[language][node.getAttribute('data-i18n-alt')];
      if (value != null) node.setAttribute('alt', value);
    });
    document.querySelectorAll('[data-i18n-content]').forEach(function (node) {
      var value = translations[language][node.getAttribute('data-i18n-content')];
      if (value != null) node.setAttribute('content', value);
    });
    document.querySelectorAll('[data-lang]').forEach(function (node) {
      node.classList.toggle('active', node.getAttribute('data-lang') === language);
    });
    var rail = document.querySelector('.rail-track');
    if (rail && !reduced) {
      rail.style.animation = 'none';
      void rail.offsetWidth;
      rail.style.animation = '';
    }
    var page = document.body.getAttribute('data-page') || 'home';
    var titles = {
      home:{ru:translations.ru['meta.homeTitle'],en:translations.en['meta.homeTitle']},
      updates:{ru:'Обновления — Vertux Nexus',en:'Updates — Vertux Nexus'},
      download:{ru:'Nexus для Windows — Vertux Nexus',en:'Nexus for Windows — Vertux Nexus'},
      account:{ru:'Вход — Vertux Nexus',en:'Sign in — Vertux Nexus'}
    };
    if (titles[page]) document.title = titles[page][language];
    document.dispatchEvent(new CustomEvent('nexus:language-change'));
  }

  document.querySelectorAll('[data-lang-toggle]').forEach(function (button) {
    button.addEventListener('click', function () { setLanguage(language === 'ru' ? 'en' : 'ru'); });
  });
  setLanguage(language);

  var header = document.getElementById('siteHeader');
  var nav = document.getElementById('mainNav');
  var menuButton = document.getElementById('menuButton');
  function updateHeader() { if (header) header.classList.toggle('scrolled', window.scrollY > 18); }
  updateHeader();
  window.addEventListener('scroll', updateHeader, {passive:true});
  if (menuButton && nav) {
    function closeMenu() {
      nav.classList.remove('open');
      document.body.classList.remove('menu-open');
      menuButton.setAttribute('aria-expanded','false');
    }
    menuButton.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      document.body.classList.toggle('menu-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        closeMenu();
      });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('open')) {
        closeMenu();
        menuButton.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1100) closeMenu();
    });
  }

  var revealNodes = document.querySelectorAll('.reveal');
  var revealObserver = null;
  if ('IntersectionObserver' in window && !reduced) {
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); }
      });
    }, {threshold:.1, rootMargin:'0px 0px -4%'});
    revealNodes.forEach(function (node) { revealObserver.observe(node); });
    requestAnimationFrame(function () {
      document.documentElement.classList.add('motion-ready');
      document.querySelectorAll('.reveal').forEach(function (node) {
        var rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) node.classList.add('visible');
      });
    });
    window.setTimeout(function () { document.documentElement.classList.remove('motion-ready'); }, 5000);
  } else {
    revealNodes.forEach(function (node) { node.classList.add('visible'); });
  }

  function activateGroup(buttonSelector, panelSelector, attribute, onActivate) {
    var buttons = document.querySelectorAll(buttonSelector);
    var panels = document.querySelectorAll(panelSelector);
    var panelAttribute = attribute.replace('tab','panel');
    if (buttons[0] && buttons[0].parentElement && !buttons[0].parentElement.hasAttribute('role')) buttons[0].parentElement.setAttribute('role','tablist');
    var namespace = attribute === 'data-demo-tab' ? 'demo' : 'world';
    buttons.forEach(function (button) {
      var target = button.getAttribute(attribute);
      var panel = Array.prototype.find.call(panels, function (candidate) { return candidate.getAttribute(panelAttribute) === target; });
      button.setAttribute('role','tab');
      button.id = namespace + '-tab-' + target;
      if (panel) button.setAttribute('aria-controls', namespace + '-panel-' + target);
    });
    panels.forEach(function (panel) {
      var target = panel.getAttribute(panelAttribute);
      panel.setAttribute('role','tabpanel');
      panel.id = namespace + '-panel-' + target;
      panel.setAttribute('aria-labelledby', namespace + '-tab-' + target);
    });
    function activate(target, source) {
      buttons.forEach(function (item) {
        var active = item.getAttribute(attribute) === target;
        item.classList.toggle('active', active);
        item.setAttribute('aria-selected', String(active));
        item.setAttribute('tabindex', active ? '0' : '-1');
      });
      panels.forEach(function (panel) {
        var active = panel.getAttribute(panelAttribute) === target;
        panel.classList.toggle('active', active);
        panel.setAttribute('aria-hidden', String(!active));
      });
      if (onActivate) onActivate(target, source);
    }
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        activate(button.getAttribute(attribute), button);
      });
      button.addEventListener('keydown', function (event) {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        var index = Array.prototype.indexOf.call(buttons, button);
        var next = (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next].focus();
        buttons[next].click();
      });
    });
    var initial = Array.prototype.find.call(buttons, function (item) { return item.classList.contains('active'); }) || buttons[0];
    if (initial) activate(initial.getAttribute(attribute));
    return activate;
  }
  var stage;
  var syncingStage = false;
  var demoNames = ['overview','process','knowledge','integrations'];
  var activateDemo = activateGroup('[data-demo-tab]','[data-demo-panel]','data-demo-tab', function (target, source) {
    if (!source || syncingStage || !stage || window.innerWidth <= 1100 || reduced) return;
    var index = demoNames.indexOf(target);
    var stageTop = window.scrollY + stage.getBoundingClientRect().top;
    var distance = Math.max(1, stage.offsetHeight - window.innerHeight);
    window.scrollTo({top: stageTop + distance * (index / (demoNames.length - 1)), behavior:'smooth'});
  });
  activateGroup('[data-world-tab]','[data-world-panel]','data-world-tab');

  document.querySelectorAll('[data-demo-note]').forEach(function (button) {
    button.addEventListener('click', function () {
      button.textContent = translations[language]['calls.added'];
      button.classList.add('done');
    });
  });

  stage = document.getElementById('product');
  var productWindow = document.getElementById('productWindow');
  var pointerY = 0;
  if (stage && productWindow && !reduced) {
    stage.addEventListener('pointermove', function (event) {
      var rect = stage.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width - .5;
      pointerY = x * 2.4;
      productWindow.style.setProperty('--ry', pointerY + 'deg');
    });
    stage.addEventListener('pointerleave', function () { pointerY = 0; productWindow.style.setProperty('--ry','0deg'); });
    var stageTicking = false;
    function animateStage() {
      var rect = stage.getBoundingClientRect();
      var vh = window.innerHeight;
      var progress;
      if (window.innerWidth <= 1100) {
        progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh * .78)));
      } else {
        var distance = Math.max(1, stage.offsetHeight - vh);
        progress = Math.max(0, Math.min(1, -rect.top / distance));
      }
      stage.style.setProperty('--stage-progress', progress.toFixed(4));
      productWindow.style.setProperty('--rx', (10 - progress * 9) + 'deg');
      productWindow.style.setProperty('--stage-scale', (.92 + progress * .08).toFixed(3));
      productWindow.style.setProperty('--lift', ((1 - progress) * 34) + 'px');
      stage.classList.toggle('motion-1', progress > .04);
      stage.classList.toggle('motion-2', progress > .27);
      stage.classList.toggle('motion-3', progress > .52);
      stage.classList.toggle('motion-4', progress > .77);
      if (window.innerWidth > 1100) {
        var index = Math.min(demoNames.length - 1, Math.floor(progress * demoNames.length));
        syncingStage = true;
        activateDemo(demoNames[index]);
        syncingStage = false;
        document.querySelectorAll('[data-stage-chapter]').forEach(function (chapter) {
          chapter.classList.toggle('active', chapter.getAttribute('data-stage-chapter') === demoNames[index]);
        });
      }
      stageTicking = false;
    }
    animateStage();
    window.addEventListener('scroll', function () { if (!stageTicking) { stageTicking = true; requestAnimationFrame(animateStage); } }, {passive:true});
  } else if (stage) {
    stage.classList.add('motion-1','motion-2','motion-3','motion-4');
  }

  if (!reduced) {
    window.addEventListener('pointermove', function (event) {
      document.documentElement.style.setProperty('--mx',event.clientX+'px');
      document.documentElement.style.setProperty('--my',event.clientY+'px');
    }, {passive:true});
    document.querySelectorAll('.magnetic').forEach(function (button) {
      button.addEventListener('pointermove', function (event) {
        var rect = button.getBoundingClientRect();
        button.style.transform = 'translate(' + ((event.clientX-rect.left-rect.width/2)*.07) + 'px,' + ((event.clientY-rect.top-rect.height/2)*.1) + 'px)';
      });
      button.addEventListener('pointerleave', function () { button.style.transform = ''; });
    });
  }

  var loginForm = document.querySelector('[data-login-form]');
  if (loginForm) {
    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var message = document.querySelector('[data-login-message]');
      if (message) message.textContent = translations[language]['account.message'];
    });
  }
})();
