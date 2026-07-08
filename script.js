// ===== CONFIG =====
console.log('%c Vertux build v12 — marquee=static-clones+translateX ', 'background:#7C5CFF;color:#fff;padding:3px 8px;border-radius:4px;font-weight:700');
const N8N_WEBHOOK_URL = 'https://zxcqweksn8n.duckdns.org/webhook/vertux-lead';
const VERTUX_BOT_URL = 'https://zxcqweksn8n.duckdns.org/webhook/vertux-widget';

// Heavy WebGL/scene animations are disabled on mobile (perf + battery).
const IS_MOBILE = window.matchMedia('(max-width: 760px)').matches;

// ===== BOT API =====
function getSessionId(key) {
  let id = localStorage.getItem(key);
  if (!id) {
    id = key + '-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}
async function vertuxBot(message, sessionKey) {
  const session_id = getSessionId(sessionKey);
  const res = await fetch(VERTUX_BOT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, message, site: 'vertux' })
  });
  if (!res.ok) throw new Error('Bot HTTP ' + res.status);
  const data = await res.json();
  if (data.action === 'HOT_LEAD') localStorage.removeItem(sessionKey);
  return data;
}

// ===== i18n =====
const T = {
  ru: {
    'nav.examples':'Примеры','nav.widget':'Виджет','nav.sites':'Сайты','nav.pricing':'Тарифы','nav.cta':'Обсудить проект →',
    'hero.kicker':'ВЕБ-СТУДИЯ · САЙТ + AI-ВИДЖЕТ ПОД КЛЮЧ',
    'hero.title':'Больше клиентов<br>из вашего сайта<br><span class="accent-word">с AI 24/7</span>',
    'hero.sub':'Делаю сайт, который вызывает доверие, и встраиваю AI-менеджера: он отвечает клиентам и ловит заявки круглосуточно — даже пока вы спите. Сайт + виджет под ключ за 3-4 дня.',
    'hero.cta1':'Смотреть работы →','hero.cta2':'Обсудить мой проект',
    'hero.stat1num':'≈3 дня','hero.stat1':'средний срок сдачи проекта','hero.stat2':'заявки без сна и выходных','hero.stat3num':'7 дней','hero.stat3':'триал виджета бесплатно',
    'hero.demoTitle':'Виджет на сайте','hero.tgMsg':'Новая заявка с сайта',
    'ex.num':'ГОТОВЫЕ ПРОЕКТЫ','ex.title':'Готовые проекты',
    'ex.lede':'Боевые сайты для реальных клиентов. Каждый - живой бизнес с заявками. Список пополняется по мере сдачи новых проектов.',
    'ex.open':'Открыть концепт ↗','ex.openLink':'Открыть концепт →','ex.more':'Готовые клиентские проекты добавляются сюда по мере сдачи','ex.case':'Разбор проекта →',
    'cn.num':'КОНЦЕПТЫ','cn.title':'Концепты под разные ниши','cn.lede':'Витрины под разные ниши, собранные с нуля - чтобы показать стиль и возможности под любой бизнес. Листай ленту, а по клику откроется живой сайт.','cn.hint':'тяни мышкой · концептов будет больше',
    'wd.cta':'Хочу виджет - узнать цену →','wd.ctaNote':'Хочешь такой виджет на свой сайт?',
    'hero.siteUrl':'your-business.ru',
    'ex.future.t':'Здесь будет ваш проект','ex.future.d':'Через неделю это место может занять ваш сайт - живой, с заявками и в этой витрине.','ex.future.cta':'Обсудить мой проект →',
    'ba.num':'БЫЛО / СТАЛО','ba.title':'Старый сайт против нового','ba.lede':'Потяни ползунок. Слева - типовой сайт «как у всех»: системный шрифт, ноль воздуха, ничего не цепляет. Справа - то, что делаю я. Виджет справа кликабельный - попробуй.','ba.old':'БЫЛО','ba.new':'СТАЛО','ba.hint':'↔ потяни ползунок · виджет справа кликабельный',
    'ba.new.cta':'Получить доступ','ba.new.eyebrow':'● AI-ПЛАТФОРМА · 2026','ba.new.h':'Аналитика, которая<br>работает <span class="mn-ac">за вас</span>','ba.new.p':'Подключите данные за минуту и получайте готовые решения. AI находит точки роста, пока вы заняты делом.','ba.new.btn':'Начать бесплатно →','ba.new.btn2':'Смотреть демо','ba.new.s1':'к конверсии','ba.new.s2':'мониторинг','ba.new.s3':'на старт','ba.new.chatTitle':'Аура · бот','ba.new.live':'+3 заявки сегодня',
    'ba.old.phone':'☎ 8 (495) 123-45-67','ba.old.hours':'Пн-Пт 9:00-18:00','ba.old.cart':'Личный кабинет','ba.old.logo':'ООО «Аура»','ba.old.n1':'Главная','ba.old.n2':'О компании','ba.old.n3':'Услуги','ba.old.n4':'Отчёты','ba.old.n5':'Новости','ba.old.n6':'Контакты','ba.old.h':'Добро пожаловать на сайт компании «Аура»!','ba.old.p1':'Наша компания более 15 лет занимается анализом данных и подготовкой отчётности для бизнеса. Предлагаем широкий спектр аналитических услуг по доступным ценам для юридических лиц.','ba.old.l1':'Сбор и обработка статистики','ba.old.l2':'Готовые отчёты в Excel по запросу','ba.old.l3':'Консультации специалиста по телефону','ba.old.btn':'Подробнее »','ba.old.img':'[ график ]','ba.old.news':'Новости','ba.old.news1':'01.03 - Обновление прайс-листа на услуги','ba.old.news2':'15.02 - Изменение графика работы отдела','ba.old.online':'Посетителей онлайн: 3','ba.old.counter':'Всего визитов: 14 285',
    'st.price':'20 000','st.cur':'₽','st.badge':'НАВСЕГДА','wg.price':'7 000','wg.cur':'₽/мес',
    'ct.ph.name':'Имя','ct.ph.contact':'@username или +7...','ct.ph.brief':'Например: сайт для студии маникюра + виджет записи','ct.ph.email':'',
    'ex.real':'★ КЛИЕНТСКИЙ ПРОЕКТ','ex.openSite':'Открыть сайт ↗','ex.openSiteLink':'Открыть сайт →',
    'ex.0.cat':'B2B · ГРЯЗЕЗАЩИТНЫЕ ПОКРЫТИЯ','ex.0.desc':'Боевой сайт для производителя грязезащитных покрытий: износостойкие ковры и алюминиевые решётки для бизнес-центров. Строгий B2B-дизайн, каталог, галерея, калькулятор расчёта и заявки прямо в мессенджеры (WhatsApp, Telegram).','ex.0.t1':'Каталог','ex.0.t2':'Калькулятор','ex.0.t3':'Заявки в мессенджеры',
    'ex.1.cat':'ФИТНЕС-ТРЕНЕР · ЛЕНДИНГ + КВИЗ-ВИДЖЕТ','ex.1.desc':'Тёмный энергичный лендинг под фитнес-эксперта. Крупная типографика, анимации, spotlight за курсором. Виджет-квиз ведёт клиента по вопросам и собирает заявку на тренировку.','ex.1.t2':'Анимации','ex.1.t3':'Квиз-виджет',
    'ex.2.cat':'РЕСТОРАН · ЛЕНДИНГ + БУКИНГ-ВИДЖЕТ','ex.2.desc':'Спокойный editorial-сайт для ресторана: тёплая палитра, акцент на еде и атмосфере, сетка блюд с фото. Виджет брони стола собирает дату, время и гостей и отправляет заявку.','ex.2.t2':'Меню с фото','ex.2.t3':'Букинг-виджет',
    'ex.3.cat':'SAAS-СЕРВИС · EN/RU · ЧАТ-ВИДЖЕТ','ex.3.desc':'Светлый продуктовый лендинг с анимированным фоном и живым интерфейсом-демо. Двуязычность EN/RU в один клик. Чат-виджет квалифицирует и записывает в лист ожидания.','ex.3.t2':'Анимация',
    'ex.4.cat':'КОФЕЙНЯ · ЛЕНДИНГ + ВИДЖЕТ ЗАКАЗА','ex.4.desc':'Тёплый лендинг для камерной кофейни третьей волны. Акцент на ритуале медленного заваривания, фото зёрен и атмосфера уюта. Виджет принимает предзаказ - кофе ждёт клиента к приходу.','ex.4.t1':'Cozy','ex.4.t2':'Меню','ex.4.t3':'Предзаказ',
    'ex.5.cat':'B2B · КАПРЕМОНТ + КАЛЬКУЛЯТОР','ex.5.desc':'B2B-лендинг компании капремонта. Серьёзная стальная палитра (Blueprint Steel), сильные офферы под бизнес-заказчика. Калькулятор сметы считает стоимость прямо на сайте и доводит до заявки.','ex.5.t1':'B2B','ex.5.t2':'Калькулятор сметы','ex.5.t3':'Industrial',
    'ex.6.cat':'САЛОН КРАСОТЫ · ЛЕНДИНГ + ЗАПИСЬ','ex.6.desc':'Премиальный лендинг для салона «Муза». Палитра Noir Couture (чёрный с золотом), редкое УТП - обслуживание «в 4 руки». Виджет берёт запись на конкретного мастера и время.','ex.6.t1':'Noir Couture','ex.6.t2':'Премиум','ex.6.t3':'Запись',
    'ex.7.cat':'B2B · ЛАЗЕРНАЯ РЕЗКА + КАЛЬКУЛЯТОР','ex.7.desc':'B2B-лендинг производства лазерной резки, маркировки и сварки металла. Тёмная тема с красным акцентом и техно-эстетикой (серийники, штрих-коды). Калькулятор считает стоимость по материалу и задаче и доводит до заявки.','ex.7.t1':'B2B','ex.7.t2':'Калькулятор','ex.7.t3':'Tech-noir',
    'wd.num':'ВИДЖЕТ','wd.title':'Потрогай виджет вживую',
    'wd.lede':'Это живой AI-виджет, а не демо со скриптами. Напиши ему как настоящему менеджеру: спроси цену, сроки, что угодно — он ответит и соберёт заявку. Так он будет общаться с твоими клиентами.',
    'wd.mode1':'Квиз-виджет','wd.mode1sub':'кнопки, чёткий сценарий','wd.mode2':'AI-виджет','wd.mode2sub':'живой диалог словами',
    'wd.quizLabel':'Сценарий под нишу:','wd.s1':'Запись','wd.s1sub':'салон, клиника, барбершоп','wd.s2':'Заявка на услугу','wd.s2sub':'ремонт, b2b, эксперты','wd.s3':'Поддержка','wd.s3sub':'магазин, доставка',
    'wd.aiLabel':'AI-виджет умеет:','wd.cap1t':'Отвечать на любые вопросы','wd.cap1d':'знает всё о товарах, ценах, условиях - как живой менеджер','wd.cap2t':'Подбирать и советовать','wd.cap2d':'помогает выбрать продукт под задачу клиента','wd.cap3t':'Собирать заявку по ходу','wd.cap3d':'общается и незаметно квалифицирует лид',
    'wd.aiNote':'Это реальный бот - отвечает живой моделью под базу знаний студии. Попробуй спросить про цены или сроки.',
    'wd.note1':'Лид падает в Telegram через секунду','wd.note2':'Сценарий и стиль настраиваются под тебя','wd.note3':'Доводит до контакта и собирает заявку',
    'st.num':'САЙТЫ','st.title':'Сайт - это лицо бизнеса',
    'st.lede':'Хороший сайт говорит за тебя ещё до первого слова: видно, что компании можно доверять, что она живая и растёт. Это выход в онлайн, охват и масштаб, которого не даёт ни визитка, ни один аккаунт в соцсетях.',
    'st.p1t':'Доверие с первого взгляда','st.p1d':'дорогой сайт = серьёзная компания','st.p2t':'Онлайн и масштаб','st.p2d':'тебя находят и днём, и ночью','st.p3t':'Ведёт к заявке','st.p3d':'структура работает на результат, не просто красиво',
    'st.cta':'Хочу сайт →','st.cardLabel':'САЙТ','st.from':'от','st.payType':'разовая оплата · сайт твой навсегда',
    'st.f1':'Индивидуальный дизайн под нишу','st.f2':'Адаптив под телефон и десктоп','st.f3':'Анимации и проработка деталей','st.f4':'Запуск, домен, передача исходников','st.f5':'Срок: 3-5 дней',
    'wg.num':'ВИДЖЕТЫ','wg.title':'Виджет - менеджер 24/7',
    'wg.lede':'Виджет встречает клиента, отвечает на вопросы и собирает заявку в любое время - даже ночью и в выходные. Один менеджер стоит от 30 000 ₽ в месяц и устаёт. Виджет работает без перерыва и стоит в разы дешевле.',
    'wg.p1t':'Работает 24/7','wg.p1d':'не спит, не болеет, не уходит в отпуск','wg.p2t':'Экономит на зарплате','wg.p2d':'7 000 ₽/мес вместо 30 000 ₽ за менеджера','wg.p3t':'Не теряет клиентов','wg.p3d':'ловит заявку в момент интереса',
    'wg.cta':'Протестировать виджет →','wg.badge':'7 ДНЕЙ БЕСПЛАТНО','wg.cardLabel':'ВИДЖЕТ','wg.from':'от','wg.permonth':'₽/мес','wg.payType':'подписка · обновления и поддержка включены',
    'wg.f1':'Квиз или живой AI-диалог','wg.f2':'Сценарий под твою нишу','wg.f3':'Заявки в Telegram или CRM','wg.f4':'Готов за 2-3 дня','wg.f5':'Первые 7 дней - бесплатный тест',
    'val.num':'ЗАЧЕМ','val.title':'Сайт приводит — виджет не упускает','val.lede':'Две части одной системы: сайт создаёт доверие и приводит людей, а виджет ловит заявку и не даёт клиенту уйти.','val.cta':'Смотреть тарифы →',
    'pk.num':'ПАКЕТ','pk.title':'Лучшее решение - пакетом',
    'pk.lede':'Сайт ловит внимание, виджет ловит заявку. Вместе - система, которая приводит клиентов и не теряет их. Выгоднее брать пакетом, но можно и по отдельности.',
    'pk.badge':'★ ВЫГОДНО · ПОД КЛЮЧ','pk.name':'Сайт + AI-виджет','pk.desc':'Готовая связка под ключ за 3-4 дня',
    'pk.priceFrom':'сайт от','pk.pricePlus':'+ виджет от',
    'pk.price1':'20 000 ₽','pk.price2':'7 000 ₽/мес','pk.st1price':'от 20 000 ₽','pk.st2price':'20 000 ₽ + 5 000 ₽/мес','pk.t1price':'5 000 ₽ + 7 000 ₽/мес','pk.t2price':'7 000 ₽ + 15 000 ₽/мес',
    'pk.f1':'Индивидуальный сайт под нишу','pk.f2':'AI-виджет ловит заявки 24/7','pk.f3':'Заявки сразу в Telegram','pk.f4':'Первые 7 дней виджета бесплатно','pk.f5':'Запуск под ключ за 3-4 дня','pk.cta':'Хочу пакет →',
    'pk.or':'или по отдельности',
    'pk.siteName':'Только сайт','pk.siteCta':'Только сайт','pk.st1name':'Без поддержки','pk.st1note':'разово · сайт твой навсегда','pk.st2name':'С поддержкой','pk.st2note':'хостинг, правки и мониторинг - на мне',
    'pk.wName':'Только виджет','pk.t1name':'Базовый','pk.t1note':'токены нейросети - на тебе','pk.t2name':'Под ключ','pk.t2note':'токены, хостинг и поддержка - на мне','pk.wCta':'Только виджет',
    'pk.foot':'Поддержка и хостинг сайта на мне - опция +5 000 ₽/мес (через Cloudflare).',
    'pr.num':'ПРОЦЕСС','pr.title':'Работаем напрямую',
    'pr.lede':'Ты общаешься с тем, кто реально делает проект. Без менеджеров-прокладок и испорченного телефона. Разбираю каждую задачу лично.',
    'pr.s1t':'Разбор задачи','pr.s1d':'Созвон или переписка: твой бизнес, цель, клиенты. Подскажу, что реально нужно, а на чём не стоит тратиться.','pr.s2t':'Направление','pr.s2d':'Покажу варианты стиля. Выбираешь то, что нравится - дальше делаю в этом направлении.','pr.s3t':'Сборка','pr.s3d':'Собираю сайт и показываю готовый результат. Дальше правим вместе, пока не станет так, как нужно.','pr.s4t':'Запуск','pr.s4d':'Публикую сайт, подключаю виджет и заявки в Telegram. По виджету всегда на связи; поддержку сайта - по желанию.',
    'pc.num':'ТАРИФЫ','pc.title':'Сколько это стоит',
    'pc.lede':'Сайт - разовая оплата, остаётся твоим. Виджет - подписка с поддержкой и бесплатным тестом. Точную цену считаю под задачу.',
    'pc.from':'от','pc.permonth':'₽/мес','pc.badge':'7 ДНЕЙ ТРИАЛ',
    'pc.1name':'Сайт','pc.1desc':'Разовая оплата · твой навсегда','pc.1f1':'Дизайн под нишу с нуля','pc.1f2':'Адаптив и анимации','pc.1f3':'Запуск + домен + исходники','pc.1f4':'Срок 5-7 дней','pc.1cta':'Хочу сайт',
    'pc.2name':'Виджет','pc.2desc':'Подписка · поддержка включена','pc.2f1':'Квиз или AI-диалог','pc.2f2':'Сценарий под бизнес','pc.2f3':'Заявки в Telegram / CRM','pc.2f4':'Первые 7 дней бесплатно','pc.2cta':'Протестировать',
    'pc.foot':'Сайт и виджет можно взять вместе - сайт разово, виджет подпиской. Напиши, посчитаю под тебя за 10 минут.',
    'faq.title':'Частые вопросы',
    'faq.q1':'Сколько занимает по времени?','faq.a1':'Сайт и виджет вместе - 3-4 дня. Отдельно сайт или отдельно виджет - 1-2 дня, максимум 3, если проект сложный. Срок зависит от того, как быстро присылаешь материалы, и от объёма проекта.',
    'faq.q2':'Почему виджет - это подписка?','faq.a2':'Виджет нужно хостить, обновлять и поддерживать, чтобы он стабильно работал и ловил заявки. Подписка покрывает это и стоит в разы дешевле живого менеджера. Сайт - другая история, он разовый и остаётся твоим.',
    'faq.q3':'Правда можно протестировать виджет бесплатно?','faq.a3':'Да. Ставлю виджет на твой сайт на 7 дней. Смотришь, как падают заявки в Telegram. Понравилось - продолжаем по подписке. Нет - снимаю без вопросов.',
    'faq.q4':'Чем отличается подписка за 7 000 и за 15 000 ₽?','faq.a4':'За 7 000 ₽/мес виджет работает на твоих ключах: токены нейросети оплачиваешь сам, поддержка базовая. За 15 000 ₽/мес всё под ключ на мне - токены, хостинг, обновления и полная поддержка, тебе вообще ни о чём не думать. Дешевле или без забот - выбираешь сам.',
    'faq.q5':'А если нужно что-то нестандартное?','faq.a5':'Напиши - обсудим. Магазин, мультистраничник, интеграции, особая анимация. Разберём задачу лично и посчитаю.',
    'faq.q6':'Кто владеет сайтом?','faq.a6':'В большинстве случаев - ты: отдаю доступ, домен и исходники оформляю на тебя. Если хочешь, чтобы сайт вёл и поддерживал я (хостинг через Cloudflare, правки, мониторинг) - это опция за 5 000 ₽/мес.',
    'ct.num':'КОНТАКТ','ct.title':'Разберём твою задачу<br><span class="accent-word">лично</span>',
    'ct.sub':'Опиши в двух словах, что нужно - вернусь с идеей и цифрой в течение дня. Можно просто потыкать виджет внизу справа: он тоже собирает заявки.',
    'ct.name':'Как тебя зовут','ct.contact':'Telegram или телефон','ct.need':'Что нужно','ct.chip1':'Сайт','ct.chip2':'Виджет','ct.chip3':'Сайт и виджет','ct.chip4':'Пока не знаю','ct.brief':'Пара слов о задаче (опционально)','ct.send':'Отправить заявку →',
    'ft.tag':'Сайты и виджеты, которые продают.','ft.nav':'Навигация','ft.contact':'Связь','ft.leave':'Оставить заявку','ft.examples':'Концепты вживую','ft.made':'собрано вручную',
    'chat.title':'Vertux · бот',
  },
  en: {
    'nav.examples':'Examples','nav.widget':'Widget','nav.sites':'Sites','nav.pricing':'Pricing','nav.cta':'Discuss a project →',
    'hero.kicker':'WEB STUDIO · SITE + AI WIDGET, TURNKEY',
    'hero.title':'More clients<br>from your site<br><span class="accent-word">with AI 24/7</span>',
    'hero.sub':'I build a site that earns trust and embed an AI manager: it answers clients and catches leads around the clock — even while you sleep. Site + widget, turnkey in 3-4 days.',
    'hero.cta1':'See work →','hero.cta2':'Discuss my project',
    'hero.stat1num':'≈3 days','hero.stat1':'average delivery time','hero.stat2':'leads, no sleep or days off','hero.stat3num':'7 days','hero.stat3':'free widget trial',
    'hero.demoTitle':'Widget on a site','hero.tgMsg':'New lead from the site',
    'ex.num':'LIVE WORK','ex.title':'Live projects',
    'ex.lede':'Production sites for real clients. Each one is a live business taking leads. The list grows as new projects ship.',
    'ex.open':'Open concept ↗','ex.openLink':'Open concept →','ex.more':'Live client projects are added here as they ship','ex.case':'Project breakdown →',
    'cn.num':'CONCEPTS','cn.title':'Concepts for different niches','cn.lede':'Showcases for different niches, built from scratch - to show the style and what is possible for any business. Drag the ribbon; click to open the live site.','cn.hint':'drag to scroll · more concepts coming',
    'wd.cta':'I want a widget - see pricing →','wd.ctaNote':'Want a widget like this on your site?',
    'hero.siteUrl':'your-business.com',
    'ex.future.t':'Your project goes here','ex.future.d':'In a week your site could take this spot - live, taking leads, right in this showcase.','ex.future.cta':'Discuss my project →',
    'ba.num':'BEFORE / AFTER','ba.title':'Old site vs new','ba.lede':'Drag the slider. On the left - a typical "everyone has it" site. On the right - what I build. The widget on the right is clickable - try it.','ba.old':'BEFORE','ba.new':'AFTER','ba.hint':'↔ drag the slider · the widget on the right is clickable',
    'ba.new.cta':'Get access','ba.new.eyebrow':'● AI PLATFORM · 2026','ba.new.h':'Analytics that<br>works <span class="mn-ac">for you</span>','ba.new.p':'Connect your data in a minute and get ready-made decisions. AI finds growth points while you focus on the work.','ba.new.btn':'Start free →','ba.new.btn2':'Watch demo','ba.new.s1':'to conversion','ba.new.s2':'monitoring','ba.new.s3':'to launch','ba.new.chatTitle':'Aura · bot','ba.new.live':'+3 leads today',
    'ba.old.phone':'☎ +1 (495) 123-45-67','ba.old.hours':'Mon-Fri 9:00-18:00','ba.old.cart':'My account','ba.old.logo':'Aura LLC','ba.old.n1':'Home','ba.old.n2':'About','ba.old.n3':'Services','ba.old.n4':'Reports','ba.old.n5':'News','ba.old.n6':'Contacts','ba.old.h':'Welcome to the Aura company website!','ba.old.p1':'Our company has been analyzing data and preparing business reports for over 15 years. We offer a wide range of analytics services at affordable prices for legal entities.','ba.old.l1':'Data collection and processing','ba.old.l2':'Ready-made Excel reports on request','ba.old.l3':'Phone consultations with a specialist','ba.old.btn':'Read more »','ba.old.img':'[ chart ]','ba.old.news':'News','ba.old.news1':'03.01 - Service price list updated','ba.old.news2':'02.15 - Department schedule change','ba.old.online':'Visitors online: 3','ba.old.counter':'Total visits: 14,285',
    'st.price':'$300','st.cur':'','st.badge':'FOREVER','wg.price':'$99','wg.cur':'/mo',
    'ct.ph.name':'Name','ct.ph.contact':'@username or +1...','ct.ph.brief':'e.g. a site for a nail studio + booking widget','ct.ph.email':'',
    'ex.real':'★ CLIENT PROJECT','ex.openSite':'Open site ↗','ex.openSiteLink':'Open site →',
    'ex.0.cat':'B2B · DIRT-BARRIER MATTING','ex.0.desc':'A live site for a manufacturer of dirt-barrier matting: wear-resistant carpets and aluminum grates for business centers. Clean B2B design, catalog, gallery, a price calculator and leads straight to messengers (WhatsApp, Telegram).','ex.0.t1':'Catalog','ex.0.t2':'Calculator','ex.0.t3':'Messenger leads',
    'ex.1.cat':'FITNESS COACH · LANDING + QUIZ WIDGET','ex.1.desc':'A bold dark landing for a fitness expert. Big typography, animations, cursor spotlight. The quiz widget walks the client through questions and collects a booking request.','ex.1.t2':'Animations','ex.1.t3':'Quiz widget',
    'ex.2.cat':'RESTAURANT · LANDING + BOOKING WIDGET','ex.2.desc':'A calm editorial site for a restaurant: warm palette, focus on food and atmosphere, a dish grid with photos. The booking widget collects date, time and guests and sends the request.','ex.2.t2':'Photo menu','ex.2.t3':'Booking widget',
    'ex.3.cat':'SAAS PRODUCT · EN/RU · CHAT WIDGET','ex.3.desc':'A light product landing with an animated background and a live UI demo. EN/RU in one click. The chat widget qualifies and signs users to the waitlist.','ex.3.t2':'Animation',
    'ex.4.cat':'COFFEE SHOP · LANDING + ORDER WIDGET','ex.4.desc':'A warm landing for a third-wave coffee shop. Focus on the ritual of slow brewing, bean photography and a cozy atmosphere. The widget takes pre-orders so coffee is waiting on arrival.','ex.4.t1':'Cozy','ex.4.t2':'Menu','ex.4.t3':'Pre-order',
    'ex.5.cat':'B2B · CAPITAL REPAIR + ESTIMATOR','ex.5.desc':'A B2B landing for a capital-repair contractor. Serious steel palette (Blueprint Steel), strong offers for business clients. An estimator calculates the price right on the site and drives to a request.','ex.5.t1':'B2B','ex.5.t2':'Cost estimator','ex.5.t3':'Industrial',
    'ex.6.cat':'BEAUTY SALON · LANDING + BOOKING','ex.6.desc':'A premium landing for the "Muza" salon. Noir Couture palette (black with gold), a rare USP - service "in 4 hands". The widget books a specific master and time slot.','ex.6.t1':'Noir Couture','ex.6.t2':'Premium','ex.6.t3':'Booking',
    'ex.7.cat':'B2B · LASER CUTTING + ESTIMATOR','ex.7.desc':'A B2B landing for laser cutting, marking and metal welding. Dark theme with a red accent and tech-noir aesthetic (serial numbers, barcodes). An estimator calculates the price by material and task and drives to a request.','ex.7.t1':'B2B','ex.7.t2':'Estimator','ex.7.t3':'Tech-noir',
    'wd.num':'WIDGET','wd.title':'Try the widget live',
    'wd.lede':'This is a live AI widget, not a scripted demo. Message it like a real manager: ask about price, timing, anything — it answers and collects the lead. This is exactly how it will talk to your clients.',
    'wd.mode1':'Quiz widget','wd.mode1sub':'buttons, clear flow','wd.mode2':'AI widget','wd.mode2sub':'live conversation',
    'wd.quizLabel':'Scenario by niche:','wd.s1':'Booking','wd.s1sub':'salon, clinic, barbershop','wd.s2':'Service request','wd.s2sub':'repair, b2b, experts','wd.s3':'Support','wd.s3sub':'shop, delivery',
    'wd.aiLabel':'The AI widget can:','wd.cap1t':'Answer any question','wd.cap1d':'knows everything about products, prices, terms - like a live manager','wd.cap2t':'Recommend and advise','wd.cap2d':'helps pick the right product for the client','wd.cap3t':'Collect the lead along the way','wd.cap3d':'chats and quietly qualifies the lead',
    'wd.aiNote':'This is a real bot - a live model answers using the studio knowledge base. Try asking about prices or timelines.',
    'wd.note1':'Lead lands in Telegram within a second','wd.note2':'Flow and style tailored to you','wd.note3':'Guides to contact and collects the lead',
    'st.num':'SITES','st.title':'A site is the face of a business',
    'st.lede':'A good site speaks for you before the first word: it shows the company is trustworthy, alive and growing. It is your move online, your reach and scale that no business card or single social account can give.',
    'st.p1t':'Trust at first glance','st.p1d':'an expensive site = a serious company','st.p2t':'Online and scale','st.p2d':'people find you day and night','st.p3t':'Drives to action','st.p3d':'structure works for results, not just looks',
    'st.cta':'I want a site →','st.cardLabel':'SITE','st.from':'from','st.payType':'one-time · the site is yours forever',
    'st.f1':'Custom design for your niche','st.f2':'Responsive on phone and desktop','st.f3':'Animations and detail work','st.f4':'Launch, domain, source handover','st.f5':'Timeline: 3-5 days',
    'wg.num':'WIDGETS','wg.title':'A widget is a 24/7 manager',
    'wg.lede':'The widget greets the client, answers questions and collects the lead any time - even at night and on weekends. One manager costs from $450 a month and gets tired. A widget runs non-stop and costs a fraction.',
    'wg.p1t':'Works 24/7','wg.p1d':'never sleeps, never sick, never on vacation','wg.p2t':'Saves on salary','wg.p2d':'$99/mo instead of $450 for a manager','wg.p3t':'Never loses a client','wg.p3d':'catches the lead at the moment of interest',
    'wg.cta':'Test the widget →','wg.badge':'7 DAYS FREE','wg.cardLabel':'WIDGET','wg.from':'from','wg.permonth':'/mo','wg.payType':'subscription · updates and support included',
    'wg.f1':'Quiz or live AI dialogue','wg.f2':'Scenario for your niche','wg.f3':'Leads to Telegram or CRM','wg.f4':'Ready in 2-3 days','wg.f5':'First 7 days - free test',
    'val.num':'WHY','val.title':'The site brings them — the widget keeps them','val.lede':'Two parts of one system: the site builds trust and brings people in, the widget catches the lead and keeps the client from leaving.','val.cta':'See pricing →',
    'pk.num':'PACKAGE','pk.title':'The best deal is the bundle',
    'pk.lede':'The site grabs attention, the widget grabs the lead. Together they are a system that brings clients and never loses them. The bundle is the best value, but you can take them separately too.',
    'pk.badge':'★ BEST VALUE · TURNKEY','pk.name':'Site + AI widget','pk.desc':'A ready bundle, turnkey in 3-4 days',
    'pk.priceFrom':'site from','pk.pricePlus':'+ widget from',
    'pk.price1':'$300','pk.price2':'$99/mo','pk.st1price':'from $300','pk.st2price':'$300 + $75/mo','pk.t1price':'$75 + $99/mo','pk.t2price':'$99 + $225/mo',
    'pk.f1':'Custom site for your niche','pk.f2':'AI widget catches leads 24/7','pk.f3':'Leads straight to Telegram','pk.f4':'First 7 days of the widget free','pk.f5':'Turnkey launch in 3-4 days','pk.cta':'I want the bundle →',
    'pk.or':'or separately',
    'pk.siteName':'Site only','pk.siteCta':'Site only','pk.st1name':'No support','pk.st1note':'one-time · the site is yours forever','pk.st2name':'With support','pk.st2note':'hosting, edits and monitoring on me',
    'pk.wName':'Widget only','pk.t1name':'Basic','pk.t1note':'AI tokens are on you','pk.t2name':'Turnkey','pk.t2note':'tokens, hosting and support on me','pk.wCta':'Widget only',
    'pk.foot':'Site hosting and support on me - an option for +$75/mo (via Cloudflare).',
    'pr.num':'PROCESS','pr.title':'We work directly',
    'pr.lede':'You talk to the person who actually builds the project. No middle managers, no broken telephone. I handle every task personally.',
    'pr.s1t':'Task review','pr.s1d':'A call or chat: your business, goal, clients. I tell you what you really need and what is not worth spending on.','pr.s2t':'Direction','pr.s2d':'I show style options. You pick what you like - I build in that direction.','pr.s3t':'Build','pr.s3d':'I build the site and show you the finished result. Then we refine it together until it is right.','pr.s4t':'Launch','pr.s4d':'I publish the site, connect the widget and leads to Telegram. Always on call for the widget; site support is optional.',
    'pc.num':'PRICING','pc.title':'What it costs',
    'pc.lede':'A site is a one-time payment and stays yours. A widget is a subscription with support and a free trial. I calculate the exact price for your task.',
    'pc.from':'from','pc.permonth':'₽/mo','pc.badge':'7-DAY TRIAL',
    'pc.1name':'Site','pc.1desc':'One-time · yours forever','pc.1f1':'Niche design from scratch','pc.1f2':'Responsive and animated','pc.1f3':'Launch + domain + sources','pc.1f4':'5-7 days','pc.1cta':'I want a site',
    'pc.2name':'Widget','pc.2desc':'Subscription · support included','pc.2f1':'Quiz or AI dialogue','pc.2f2':'Scenario for your business','pc.2f3':'Leads to Telegram / CRM','pc.2f4':'First 7 days free','pc.2cta':'Test it',
    'pc.foot':'You can take a site and a widget together - site one-time, widget by subscription. Message me, I will price it for you in 10 minutes.',
    'faq.title':'FAQ',
    'faq.q1':'How long does it take?','faq.a1':'Site and widget together - 3-4 days. Site alone or widget alone - 1-2 days, 3 max for a complex project. The timeline depends on how fast you send materials and on the scope.',
    'faq.q2':'Why is the widget a subscription?','faq.a2':'A widget needs hosting, updates and support to run reliably and catch leads. The subscription covers that and costs a fraction of a live manager. A site is different - it is one-time and stays yours.',
    'faq.q3':'Can I really test the widget for free?','faq.a3':'Yes. I put the widget on your site for 7 days. You watch leads land in Telegram. If you like it, we continue on subscription. If not, I remove it, no questions.',
    'faq.q4':'What is the difference between the $99 and $225 plans?','faq.a4':'At $99/mo the widget runs on your keys: you pay the AI tokens yourself and support is basic. At $225/mo everything is turnkey on me - tokens, hosting, updates and full support, nothing for you to think about. Cheaper, or hands-off - your call.',
    'faq.q5':'What if I need something non-standard?','faq.a5':'Message me - we will discuss. Store, multi-page, integrations, special animation. We review the task personally and I price it.',
    'faq.q6':'Who owns the site?','faq.a6':'In most cases - you: I hand over access, the domain and sources are registered to you. If you want me to host and maintain it (Cloudflare hosting, edits, monitoring) - that is an option for $75/mo.',
    'ct.num':'CONTACT','ct.title':'Let us review your task<br><span class="accent-word">in person</span>',
    'ct.sub':'Describe in a couple words what you need - I will come back with an idea and a number within a day. Or just play with the widget bottom right: it collects leads too.',
    'ct.name':'Your name','ct.contact':'Telegram or phone','ct.need':'What you need','ct.chip1':'Site','ct.chip2':'Widget','ct.chip3':'Site and widget','ct.chip4':'Not sure yet','ct.brief':'A couple words about the task (optional)','ct.send':'Send request →',
    'ft.tag':'Sites and widgets that sell.','ft.nav':'Navigation','ft.contact':'Contact','ft.leave':'Leave a request','ft.examples':'Concepts live','ft.made':'built by hand',
    'chat.title':'Vertux · bot',
  },
};

let lang = localStorage.getItem('sborka-lang') || 'ru';
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = T[lang][el.getAttribute('data-i18n')]; if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const v = T[lang][el.getAttribute('data-i18n-html')]; if (v != null) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const v = T[lang][el.getAttribute('data-i18n-ph')]; if (v != null) el.placeholder = v;
  });
  document.querySelector('.lang-ru').classList.toggle('active', lang === 'ru');
  document.querySelector('.lang-en').classList.toggle('active', lang === 'en');
  buildMarquee();
}
document.getElementById('langToggle').addEventListener('click', () => {
  lang = lang === 'ru' ? 'en' : 'ru';
  localStorage.setItem('sborka-lang', lang);
  applyLang();
  startScene();
  if (typeof demoStarted !== 'undefined' && demoStarted) { aiStart(); }
  if (chatWindow.classList.contains('open')) chatStart();
});

// ===== MARQUEE (value phrases) =====
const MARQ = {
  ru: ['Заявки 24/7','Уведомления в Telegram','Экономия на менеджере','Онлайн без выходных','Сайт под ключ','Виджет за 2-3 дня','AI-диалог','Триал 7 дней'],
  en: ['Leads 24/7','Telegram alerts','Saves on a manager','Online, no days off','Turnkey site','Widget in 2-3 days','AI dialogue','7-day trial'],
};
function buildMarquee() {
  const track = document.getElementById('marqueeTrack');
  const items = MARQ[lang];
  let html = '';
  for (let r = 0; r < 2; r++) {
    items.forEach(t => { html += `<span>${t}</span><span class="m-dot">✦</span>`; });
  }
  track.innerHTML = html;
}

// ===== CURSOR GLOW =====
const glow = document.getElementById('cursorGlow');
let glowOn = false;
window.addEventListener('mousemove', (e) => {
  if (!glowOn) { glow.style.opacity = '1'; glowOn = true; }
  glow.style.transform = `translate(${e.clientX - 250}px, ${e.clientY - 250}px)`;
}, { passive: true });

// ===== NAV / MAGNETIC / COUNTER / REVEAL / FAQ =====
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 20), { passive: true });

document.querySelectorAll('[data-magnetic]').forEach(el => {
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - r.left - r.width/2) * 0.3}px, ${(e.clientY - r.top - r.height/2) * 0.3}px)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
});

function animateCounter(el) {
  const target = parseInt(el.dataset.counter, 10);
  const suffix = el.dataset.suffix || '';
  if (isNaN(target)) return;
  const dur = 1300, start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * e) + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
const counterObs = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); counterObs.unobserve(e.target); } }), { threshold: 0.5 });
document.querySelectorAll('[data-counter]').forEach(c => counterObs.observe(c));

const revObs = new IntersectionObserver((es) => {
  es.forEach(entry => {
    if (entry.isIntersecting) {
      const sibs = Array.from(entry.target.parentElement.children).filter(c => c.classList.contains('reveal'));
      setTimeout(() => entry.target.classList.add('in'), Math.min(sibs.indexOf(entry.target), 5) * 90);
      revObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
document.querySelectorAll('.reveal').forEach(r => revObs.observe(r));

document.querySelectorAll('.faq-item').forEach(item => item.querySelector('.faq-q').addEventListener('click', () => item.classList.toggle('open')));

// ===== LEAD SEND =====
async function sendLead(data) {
  /* PROD:
  const res = await fetch(N8N_WEBHOOK_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({...data, url:location.href, ts:new Date().toISOString()}) });
  if (!res.ok) throw new Error('HTTP '+res.status); return res.json();
  */
  console.log('[LEAD] →', data);
  await new Promise(r => setTimeout(r, 600));
  return { ok: true };
}

// ===== CONTACT FORM =====
const cfChips = document.getElementById('cfChips');
const cfService = document.getElementById('cfService');
cfChips.querySelectorAll('.cf-chip').forEach(chip => chip.addEventListener('click', () => {
  cfChips.querySelectorAll('.cf-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active'); cfService.value = chip.dataset.val;
}));
const contactForm = document.getElementById('contactForm');
const cfResult = document.getElementById('cfResult');
contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(contactForm).entries());
  if (!data.service) { cfResult.textContent = lang==='ru'?'Выбери, что нужно ↑':'Pick what you need ↑'; cfResult.style.color = '#FF6B6B'; return; }
  cfResult.textContent = lang==='ru'?'Отправляю...':'Sending...'; cfResult.style.color = 'var(--muted)';
  try {
    await sendLead({ ...data, source: 'portfolio-form' });
    cfResult.textContent = lang==='ru'?'Готово. Вернусь к тебе в течение дня.':'Done. I will get back to you within a day.';
    cfResult.style.color = 'var(--accent-2)';
    contactForm.reset(); cfChips.querySelectorAll('.cf-chip').forEach(c => c.classList.remove('active'));
  } catch (err) { cfResult.textContent = lang==='ru'?'Не отправилось. Напиши в Telegram.':'Failed. Message me on Telegram.'; cfResult.style.color = '#FF6B6B'; }
});

// ===== CINEMATIC HERO SCENE (site -> cursor -> widget -> telegram) =====
const sBubble = document.getElementById('sceneBubble');
const sChat = document.getElementById('sceneChat');
const sBody = document.getElementById('sceneBody');
const sCursor = document.getElementById('sceneCursor');
const sTg = document.getElementById('sceneTg');
const tgMsg = document.getElementById('tgMsg');

const HERO_SCRIPT = {
  ru: {
    dialog: [
      { who:'bot', text:'Привет! Запишу вас за минуту. Что интересует?' },
      { who:'user', text:'Окрашивание' },
      { who:'bot', text:'Когда удобно?' },
      { who:'user', text:'Суббота, вечер' },
      { who:'bot', text:'Готово ✓ Оставьте телефон.' },
      { who:'user', text:'+7 905 ...' },
    ],
    tg: 'Новая заявка: Окрашивание · Сб вечер · +7 905...',
  },
  en: {
    dialog: [
      { who:'bot', text:'Hi! I will book you in a minute. What for?' },
      { who:'user', text:'Hair coloring' },
      { who:'bot', text:'When works for you?' },
      { who:'user', text:'Saturday, evening' },
      { who:'bot', text:'Done ✓ Leave your phone.' },
      { who:'user', text:'+1 905 ...' },
    ],
    tg: 'New lead: Hair coloring · Sat evening · +1 905...',
  },
};

let sceneRun = 0;
function sMsg(m) {
  const b = document.createElement('div');
  b.className = `msg ${m.who}`; b.textContent = m.text;
  sBody.appendChild(b); sBody.scrollTop = sBody.scrollHeight;
}
function sTyping() {
  const t = document.createElement('div');
  t.className = 'msg bot typing'; t.innerHTML = '<span></span><span></span><span></span>';
  sBody.appendChild(t); sBody.scrollTop = sBody.scrollHeight; return t;
}
function cursorTo(x, y) { sCursor.style.left = x; sCursor.style.top = y; }

function playDialog(dialog, i, my) {
  if (my !== sceneRun) return;
  if (i >= dialog.length) {
    setTimeout(() => { if (my === sceneRun) { tgMsg.textContent = HERO_SCRIPT[lang].tg; sTg.classList.add('show'); } }, 500);
    setTimeout(() => { if (my === sceneRun) startScene(); }, 4200);
    return;
  }
  const m = dialog[i];
  if (m.who === 'bot') {
    const typ = sTyping();
    setTimeout(() => { if (my !== sceneRun) { typ.remove(); return; } typ.remove(); sMsg(m); setTimeout(() => playDialog(dialog, i + 1, my), 650); }, 720);
  } else {
    sMsg(m); setTimeout(() => playDialog(dialog, i + 1, my), 800);
  }
}

function startScene() {
  if (!sBubble) return;
  if (IS_MOBILE) { sBubble.classList.remove('hidden'); return; }
  const my = ++sceneRun;
  const T = (fn, ms) => setTimeout(() => { if (my === sceneRun) fn(); }, ms);
  // reset
  sChat.classList.remove('open'); sBubble.classList.remove('hidden', 'clicked');
  sTg.classList.remove('show'); sBody.innerHTML = ''; sCursor.classList.remove('tap');
  cursorTo('36%', '40%');
  // 1. cursor to widget bubble center (bubble = 46px @ bottom:16 right:16)
  T(() => { const r = sBubble.getBoundingClientRect(); const p = sBubble.parentElement.getBoundingClientRect(); cursorTo(((r.left - p.left + r.width/2) / p.width * 100) + '%', ((r.top - p.top + r.height/2) / p.height * 100) + '%'); }, 800);
  // 2. tap
  T(() => { sCursor.classList.add('tap'); sBubble.classList.add('clicked'); }, 1850);
  T(() => sCursor.classList.remove('tap'), 2050);
  // 3. open chat, hide bubble, cursor moves up-left
  T(() => { sBubble.classList.add('hidden'); sChat.classList.add('open'); cursorTo('24%', '28%'); }, 2150);
  // 4. dialog
  T(() => playDialog(HERO_SCRIPT[lang].dialog, 0, my), 2650);
}

// ===== WIDGET DEMO (single live AI chat) =====
const demoBody = document.getElementById('demoBody');
const demoForm = document.getElementById('demoForm');
const demoInput = document.getElementById('demoInput');
const demoTitle = document.getElementById('demoTitle');

function dMsg(text, who='bot', html=false) {
  const m = document.createElement('div'); m.className = `msg ${who}`;
  if (html) m.innerHTML = text; else m.textContent = text;
  demoBody.appendChild(m); demoBody.scrollTop = demoBody.scrollHeight; return m;
}
function dType(cb, delay=700) {
  const t = document.createElement('div'); t.className='msg bot typing'; t.innerHTML='<span></span><span></span><span></span>';
  demoBody.appendChild(t); demoBody.scrollTop = demoBody.scrollHeight;
  setTimeout(() => { t.remove(); cb(); }, delay);
}

// AI engine (live conversation via n8n webhook)
const AI = {
  ru: {
    title:'Vertux · AI-ассистент',
    hello:'Привет! Я AI-ассистент студии Vertux. Спросите что угодно - про сайты, виджеты, цены, сроки. Так же я буду общаться с вашими клиентами.',
    placeholder:'Напишите сообщение...',
  },
  en: {
    title:'Vertux · AI assistant',
    hello:'Hi! I am the Vertux studio AI assistant. Ask anything - about sites, widgets, prices, timelines. This is exactly how I will talk to your clients.',
    placeholder:'Type a message...',
  },
};

function aiStart() {
  demoBody.innerHTML='';
  demoTitle.textContent = AI[lang].title;
  demoForm.style.display='flex';
  demoInput.placeholder = AI[lang].placeholder;
  demoInput.value='';
  dType(() => dMsg(AI[lang].hello, 'bot'), 600);
}
async function aiReply(text) {
  // Real bot via n8n webhook
  const t = document.createElement('div');
  t.className = 'msg bot typing';
  t.innerHTML = '<span></span><span></span><span></span>';
  demoBody.appendChild(t); demoBody.scrollTop = demoBody.scrollHeight;
  try {
    const { reply } = await vertuxBot(text, 'vertux_session_demo');
    t.remove();
    dMsg(reply || (lang==='ru' ? 'Пустой ответ.' : 'Empty reply.'), 'bot');
  } catch (e) {
    t.remove();
    dMsg(lang==='ru' ? 'Извините, временный сбой связи. Попробуйте ещё раз.' : 'Sorry, temporary network error. Try again.', 'bot');
    console.error('[aiReply]', e);
  }
}

demoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const v = demoInput.value.trim(); if (!v) return;
  dMsg(v, 'user'); demoInput.value='';
  aiReply(v);
});

let demoStarted = false;
new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting && !demoStarted) { demoStarted = true; aiStart(); } }), { threshold: 0.3 })
  .observe(document.querySelector('.demo-phone'));

// ===== CHAT WIDGET =====
const chatToggle = document.getElementById('chatToggle');
const chatWindow = document.getElementById('chatWindow');
const chatClose = document.getElementById('chatClose');
const chatBody = document.getElementById('chatBody');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

const CHAT_HELLO = {
  ru: 'Привет! Я AI-ассистент Vertux. Расскажите про вашу задачу — сайт, AI-виджет или просто хотите прицениться? Отвечу на любые вопросы.',
  en: 'Hi! I am the Vertux AI assistant. Tell me about your task — site, AI-widget, or just pricing? I will answer any questions.',
};
function cMsg(text, who='bot') { const m=document.createElement('div'); m.className=`msg ${who}`; m.textContent=text; chatBody.appendChild(m); chatBody.scrollTop=chatBody.scrollHeight; }
function cTyping() { const t=document.createElement('div'); t.className='msg bot typing'; t.innerHTML='<span></span><span></span><span></span>'; chatBody.appendChild(t); chatBody.scrollTop=chatBody.scrollHeight; return t; }
function chatStart(){
  chatBody.innerHTML='';
  const t = cTyping();
  setTimeout(()=>{ t.remove(); cMsg(CHAT_HELLO[lang],'bot'); chatForm.style.display='flex'; chatInput.placeholder = lang==='ru'?'Напишите сообщение...':'Type a message...'; chatInput.focus(); }, 650);
}
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = chatInput.value.trim(); if (!v) return;
  cMsg(v,'user'); chatInput.value=''; chatInput.disabled = true;
  const t = cTyping();
  try {
    const { reply } = await vertuxBot(v, 'vertux_session_chat');
    t.remove();
    cMsg(reply || (lang==='ru'?'Пустой ответ.':'Empty reply.'),'bot');
  } catch (err) {
    t.remove();
    cMsg(lang==='ru'?'Извините, временный сбой связи. Попробуйте ещё раз.':'Sorry, temporary network error. Try again.','bot');
    console.error('[chat]', err);
  } finally {
    chatInput.disabled = false; chatInput.focus();
  }
});
function openChat(){ chatWindow.classList.add('open'); if(!chatBody.children.length) chatStart(); }
function closeChat(){ chatWindow.classList.remove('open'); }
chatToggle.addEventListener('click',()=>chatWindow.classList.contains('open')?closeChat():openChat());
chatClose.addEventListener('click',closeChat);
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape'&&chatWindow.classList.contains('open'))closeChat(); });

// ===== LIVE FRAME SCALING (concept previews) =====
function scaleLiveFrames() {
  document.querySelectorAll('.live-frame').forEach(f => {
    const wrap = f.parentElement; const w = wrap.clientWidth; if (!w) return;
    const base = 1280;
    f.style.width = base + 'px';
    f.style.height = (base * 0.625) + 'px';
    f.style.transform = 'scale(' + (w / base) + ')';
  });
}
window.addEventListener('resize', scaleLiveFrames, { passive: true });
// lazy-load each concept iframe only when its card nears the viewport (keeps page light)
const liveObs = new IntersectionObserver((es) => {
  es.forEach(e => {
    if (e.isIntersecting) {
      const f = e.target;
      if (f.dataset.src && !f.src) { f.addEventListener('load', scaleLiveFrames); f.src = f.dataset.src; }
      scaleLiveFrames();
      liveObs.unobserve(f);
    }
  });
}, { rootMargin: '350px' });
document.querySelectorAll('.live-frame').forEach(f => liveObs.observe(f));

// ===== CONCEPTS RIBBON — seamless marquee via translateX (clones, never reparented) =====
// NB: iframes must NEVER be moved in the DOM after load — re-parenting forces a reload
// (flicker/lag). So we clone the set ONCE, load all iframes once, then only transform.
(function autoScrollConcepts() {
  const row = document.querySelector('.concept-row');
  if (!row) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const originals = [...row.children];
  if (!originals.length) return;

  const track = document.createElement('div');
  track.className = 'concept-track';
  originals.forEach(c => track.appendChild(c));
  // duplicate the set once for a seamless wrap; clones stay put forever.
  // `inert` (not aria-hidden) hides them from a11y AND prevents focus — avoids the
  // "aria-hidden on focused element" warning and any focus-induced scrolling.
  originals.forEach(c => {
    const clone = c.cloneNode(true);
    clone.inert = true;
    // CRITICAL: strip the scroll-reveal class — the IntersectionObserver only watches the
    // originals, so a cloned `.reveal` would stay opacity:0 forever (invisible clone = "gap").
    clone.classList.remove('reveal');
    clone.querySelectorAll('.reveal').forEach(el => el.classList.remove('reveal'));
    track.appendChild(clone);
  });
  // make sure the originals are shown too (in case they were cloned before being revealed)
  originals.forEach(c => { c.classList.remove('reveal'); c.querySelectorAll('.reveal').forEach(el => el.classList.remove('reveal')); });
  row.appendChild(track);

  // eager-load every preview image (originals + clones) so nothing is ever blank
  // mid-loop — clones are off-screen so lazy-loading would leave them empty.
  track.querySelectorAll('img').forEach(im => { im.loading = 'eager'; if (im.dataset.src && !im.src) im.src = im.dataset.src; });

  let oneSet = 0; // exact px width of one full set (originals)
  function measure() {
    const mark = track.children[originals.length]; // first clone
    if (mark) {
      const val = mark.offsetLeft - track.children[0].offsetLeft;
      if (val > 0) oneSet = val;
    }
    window.__MARQUEE_DEBUG = { oneSet, kids: track.children.length, origLen: originals.length, get pos() { return pos; } };
  }
  // re-measure on ANY layout change (fonts/images loading, resize) — a stale oneSet makes
  // the wrap jump by the difference every cycle, which reads as the ribbon "breaking".
  if (window.ResizeObserver) { new ResizeObserver(measure).observe(track); }
  window.addEventListener('load', measure);
  track.querySelectorAll('img').forEach(im => im.addEventListener('load', measure));

  const SPEED = 28;         // px/sec
  const RESUME_MS = 10000;
  let pos = 0;              // content shifts left as pos grows
  let paused = false, resumeT = null, started = false;
  let rafId = null, lastT = 0;

  function apply() {
    // modulo wrap — pos is always normalised into [0, oneSet); content is duplicated,
    // so any jump by a multiple of oneSet is invisible. Bulletproof vs. overshoot.
    if (oneSet > 0) pos = ((pos % oneSet) + oneSet) % oneSet;
    track.style.transform = 'translate3d(' + (-pos) + 'px,0,0)';
  }
  // smooth 60fps via requestAnimationFrame, delta-timed so speed is frame-rate independent
  function frame(now) {
    if (!lastT) lastT = now;
    const dt = Math.min(64, now - lastT);
    lastT = now;
    // a focused link can make the browser set scrollLeft even on overflow:hidden — undo it
    if (row.scrollLeft !== 0) row.scrollLeft = 0;
    const r = row.getBoundingClientRect();
    const visible = r.bottom > 0 && r.top < window.innerHeight;
    if (!paused && visible) { pos += SPEED * dt / 1000; apply(); }
    rafId = requestAnimationFrame(frame);
  }
  function pauseAuto() {
    paused = true;
    if (resumeT) clearTimeout(resumeT);
    resumeT = setTimeout(() => { paused = false; }, RESUME_MS);
  }

  // ----- drag (mouse + touch) — transform only, iframes untouched -----
  let dragging = false, sx = 0, sp = 0, moved = false;
  const TH = 6;
  row.style.cursor = 'grab';
  row.addEventListener('pointerdown', (e) => {
    pauseAuto(); dragging = true; moved = false; sx = e.clientX; sp = pos;
  });
  row.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx;
    if (Math.abs(dx) > TH) {
      if (!moved) {
        moved = true; row.style.cursor = 'grabbing';
        if (e.pointerType === 'mouse') { try { row.setPointerCapture(e.pointerId); } catch (_) {} }
      }
      pos = sp - dx; apply();
    }
  });
  function end(e) {
    if (!dragging) return;
    dragging = false; row.style.cursor = 'grab';
    if (moved && e && e.pointerId !== undefined) { try { row.releasePointerCapture(e.pointerId); } catch (_) {} }
  }
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => row.addEventListener(ev, end));
  row.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
  row.addEventListener('touchstart', pauseAuto, { passive: true });
  window.addEventListener('resize', measure, { passive: true });

  function start() {
    if (started) return; started = true;
    // load every iframe (originals + clones) exactly once
    track.querySelectorAll('iframe[data-src]').forEach(f => {
      if (!f.src) { f.addEventListener('load', scaleLiveFrames); f.src = f.dataset.src; }
    });
    measure();
    setTimeout(() => { scaleLiveFrames(); measure(); }, 120);
    lastT = 0;
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }
  // robust start: IntersectionObserver + scroll fallback + timer fallback.
  // The frame loop itself skips advancing while the section is off-screen,
  // so we don't depend on the observer for pausing.
  const io = new IntersectionObserver((es) => { if (es.some(e => e.isIntersecting)) start(); }, { rootMargin: '300px' });
  io.observe(row);
  function onScroll() {
    const r = row.getBoundingClientRect();
    if (r.top < window.innerHeight + 300 && r.bottom > -300) { start(); window.removeEventListener('scroll', onScroll); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  setTimeout(start, 2500);
})();

// ===== AURA MOCK STATS animation (before/after — new site) =====
(function animateAuraStats() {
  const app = document.querySelector('.mn2-app');
  if (!app) return;

  function countUp(el, to, opts = {}) {
    const { prefix = '', suffix = '', duration = 1400, decimals = 0, grouped = false } = opts;
    const start = performance.now();
    const id = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = to * eased;
      let txt = decimals ? val.toFixed(decimals) : Math.round(val).toString();
      if (grouped) txt = txt.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      el.textContent = prefix + txt + suffix;
      if (p >= 1) clearInterval(id);
    }, 33);
  }

  let lastRunAt = 0;
  function run() {
    // re-run allowed, but throttle so dragging slider doesn't spam
    const now = performance.now();
    if (now - lastRunAt < 1200) return;
    lastRunAt = now;

    const kpi = app.querySelector('.mn2-kpi-v');
    const up = app.querySelector('.mn2-kpi-up');
    const tiles = app.querySelectorAll('.mn2-tile b');
    const bars = app.querySelectorAll('.mn2-chart i');

    if (kpi) kpi.textContent = '₽0';
    if (up) up.textContent = '▲ 0% к прошлому месяцу';
    if (tiles[0]) tiles[0].textContent = '0';
    if (tiles[1]) tiles[1].textContent = '0%';
    if (tiles[2]) tiles[2].textContent = '0.0';
    bars.forEach((b, i) => {
      b.style.height = '0%';
      b.style.transition = 'height 900ms cubic-bezier(.2,.8,.2,1)';
      b.style.transitionDelay = (i * 80) + 'ms';
    });

    setTimeout(() => {
      if (kpi) countUp(kpi, 1248900, { prefix: '₽', grouped: true, duration: 1700 });
      if (up) countUp(up, 47, { prefix: '▲ ', suffix: '% к прошлому месяцу', duration: 1400 });
      if (tiles[0]) countUp(tiles[0], 2480, { grouped: true });
      if (tiles[1]) countUp(tiles[1], 18, { suffix: '%' });
      if (tiles[2]) countUp(tiles[2], 4.9, { decimals: 1 });
      bars.forEach(b => { b.style.height = b.style.getPropertyValue('--h') || '50%'; });
    }, 80);
  }
  // expose so the before/after slider can re-trigger
  window.__replayAuraStats = run;

  function checkVisible() {
    const r = app.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.8 && r.bottom > 0) run();
  }

  const io = new IntersectionObserver((es) => {
    es.forEach(e => { if (e.isIntersecting) { run(); io.disconnect(); } });
  }, { threshold: 0.3 });
  io.observe(app);

  window.addEventListener('scroll', () => {
    const r = app.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.8 && r.bottom > 0 && lastRunAt === 0) run();
  }, { passive: true });
  setTimeout(checkVisible, 500);
})();

// ===== HERO SHADER BACKGROUND (WebGL plasma) =====
(function initHeroShader() {
  const canvas = document.getElementById('heroShader');
  if (!canvas) return;
  if (IS_MOBILE) { canvas.style.display = 'none'; return; }
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.display = 'none'; return; }
  const vs = 'attribute vec4 aVertexPosition; void main(){ gl_Position = aVertexPosition; }';
  const fs = `precision highp float;
    uniform vec2 iResolution; uniform float iTime;
    const float overallSpeed = 0.2;
    const float gridSmoothWidth = 0.015;
    const float axisWidth = 0.05;
    const float majorLineWidth = 0.025;
    const float minorLineWidth = 0.0125;
    const float majorLineFrequency = 5.0;
    const float minorLineFrequency = 1.0;
    const float scale = 5.0;
    const vec4 lineColor = vec4(0.45, 0.30, 1.0, 1.0);
    const float minLineWidth = 0.01;
    const float maxLineWidth = 0.2;
    const float lineSpeed = 1.0 * overallSpeed;
    const float lineAmplitude = 1.0;
    const float lineFrequency = 0.2;
    const float warpSpeed = 0.2 * overallSpeed;
    const float warpFrequency = 0.5;
    const float warpAmplitude = 1.0;
    const float offsetFrequency = 0.5;
    const float offsetSpeed = 1.33 * overallSpeed;
    const float minOffsetSpread = 0.6;
    const float maxOffsetSpread = 2.0;
    const int linesPerGroup = 16;
    #define drawCircle(pos, radius, coord) smoothstep(radius + gridSmoothWidth, radius, length(coord - (pos)))
    #define drawSmoothLine(pos, halfWidth, t) smoothstep(halfWidth, 0.0, abs(pos - (t)))
    #define drawCrispLine(pos, halfWidth, t) smoothstep(halfWidth + gridSmoothWidth, halfWidth, abs(pos - (t)))
    #define drawPeriodicLine(freq, width, t) drawCrispLine(freq / 2.0, width, abs(mod(t, freq) - (freq) / 2.0))
    float drawGridLines(float axis){ return drawCrispLine(0.0, axisWidth, axis) + drawPeriodicLine(majorLineFrequency, majorLineWidth, axis) + drawPeriodicLine(minorLineFrequency, minorLineWidth, axis); }
    float drawGrid(vec2 space){ return min(1.0, drawGridLines(space.x) + drawGridLines(space.y)); }
    float random(float t){ return (cos(t) + cos(t * 1.3 + 1.3) + cos(t * 1.4 + 1.4)) / 3.0; }
    float getPlasmaY(float x, float horizontalFade, float offset){ return random(x * lineFrequency + iTime * lineSpeed) * horizontalFade * lineAmplitude + offset; }
    void main(){
      vec2 fragCoord = gl_FragCoord.xy;
      vec4 fragColor;
      vec2 uv = fragCoord.xy / iResolution.xy;
      vec2 space = (fragCoord - iResolution.xy / 2.0) / iResolution.x * 2.0 * scale;
      float horizontalFade = 1.0 - (cos(uv.x * 6.28) * 0.5 + 0.5);
      float verticalFade = 1.0 - (cos(uv.y * 6.28) * 0.5 + 0.5);
      space.y += random(space.x * warpFrequency + iTime * warpSpeed) * warpAmplitude * (0.5 + horizontalFade);
      space.x += random(space.y * warpFrequency + iTime * warpSpeed + 2.0) * warpAmplitude * horizontalFade;
      vec4 lines = vec4(0.0);
      vec4 bgColor1 = vec4(0.05, 0.04, 0.10, 1.0);
      vec4 bgColor2 = vec4(0.14, 0.07, 0.28, 1.0);
      for(int l = 0; l < linesPerGroup; l++){
        float normalizedLineIndex = float(l) / float(linesPerGroup);
        float offsetTime = iTime * offsetSpeed;
        float offsetPosition = float(l) + space.x * offsetFrequency;
        float rand = random(offsetPosition + offsetTime) * 0.5 + 0.5;
        float halfWidth = mix(minLineWidth, maxLineWidth, rand * horizontalFade) / 2.0;
        float offset = random(offsetPosition + offsetTime * (1.0 + normalizedLineIndex)) * mix(minOffsetSpread, maxOffsetSpread, horizontalFade);
        float linePosition = getPlasmaY(space.x, horizontalFade, offset);
        float line = drawSmoothLine(linePosition, halfWidth, space.y) / 2.0 + drawCrispLine(linePosition, halfWidth * 0.15, space.y);
        float circleX = mod(float(l) + iTime * lineSpeed, 25.0) - 12.0;
        vec2 circlePosition = vec2(circleX, getPlasmaY(circleX, horizontalFade, offset));
        float circle = drawCircle(circlePosition, 0.01, space) * 4.0;
        line = line + circle;
        lines += line * lineColor * rand;
      }
      fragColor = mix(bgColor1, bgColor2, uv.x);
      fragColor *= verticalFade;
      fragColor.a = 1.0;
      fragColor += lines;
      gl_FragColor = fragColor;
    }`;
  function compile(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){ console.error('shader', gl.getShaderInfoLog(s)); return null; } return s; }
  const prog = gl.createProgram();
  const v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
  if(!v || !f){ canvas.style.display='none'; return; }
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ canvas.style.display='none'; return; }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aVertexPosition');
  const uRes = gl.getUniformLocation(prog, 'iResolution');
  const uTime = gl.getUniformLocation(prog, 'iTime');
  const hero = canvas.closest('.hero');
  function resize(){ const dpr = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = hero.clientWidth * dpr; canvas.height = hero.clientHeight * dpr; gl.viewport(0,0,canvas.width,canvas.height); }
  window.addEventListener('resize', resize, { passive: true }); resize();
  const start = Date.now(); let raf = null;
  function render(){ const t = (Date.now() - start) / 1000; gl.useProgram(prog); gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uTime, t); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aPos); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); raf = requestAnimationFrame(render); }
  render();
  new IntersectionObserver((es) => { es.forEach(e => { if(e.isIntersecting){ if(!raf) render(); } else if(raf){ cancelAnimationFrame(raf); raf = null; } }); }, { threshold: 0 }).observe(hero);
})();

// ===== CONTACT SHADER (WebGL RGB sine) =====
(function initContactShader() {
  const canvas = document.getElementById('contactShader');
  if (!canvas) return;
  if (IS_MOBILE) { canvas.style.display = 'none'; return; }
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { canvas.style.display = 'none'; return; }
  const vs = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  const fs = `precision highp float;
    uniform vec2 resolution; uniform float time;
    const float xScale = 1.0; const float yScale = 0.5; const float distortion = 0.05;
    void main(){
      vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
      float d = length(p) * distortion;
      float rx = p.x * (1.0 + d); float gx = p.x; float bx = p.x * (1.0 - d);
      float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
      float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
      float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);
      gl_FragColor = vec4(r * 0.55, g * 0.45, b * 1.0, 1.0);
    }`;
  function compile(t, s){ const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){ console.error(gl.getShaderInfoLog(sh)); return null; } return sh; }
  const prog = gl.createProgram(); const v = compile(gl.VERTEX_SHADER, vs), f = compile(gl.FRAGMENT_SHADER, fs);
  if(!v||!f){ canvas.style.display='none'; return; }
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ canvas.style.display='none'; return; }
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p'); const uR = gl.getUniformLocation(prog, 'resolution'); const uT = gl.getUniformLocation(prog, 'time');
  const sec = canvas.closest('.contact');
  function resize(){ const dpr = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = sec.clientWidth * dpr; canvas.height = sec.clientHeight * dpr; gl.viewport(0,0,canvas.width,canvas.height); }
  window.addEventListener('resize', resize, { passive: true }); resize();
  let t = 0, raf = null;
  function render(){ t += 0.01; gl.useProgram(prog); gl.uniform2f(uR, canvas.width, canvas.height); gl.uniform1f(uT, t); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(aP); gl.drawArrays(gl.TRIANGLES, 0, 6); raf = requestAnimationFrame(render); }
  new IntersectionObserver((es) => { es.forEach(e => { if(e.isIntersecting){ resize(); if(!raf) render(); } else if(raf){ cancelAnimationFrame(raf); raf = null; } }); }, { threshold: 0 }).observe(sec);
})();

// ===== BEFORE / AFTER SLIDER =====
(function initBA() {
  const wrap = document.getElementById('baWrap'); if (!wrap) return;
  const oldPane = document.getElementById('baOld'); const handle = document.getElementById('baHandle');
  let dragging = false;
  function setPct(pct){ pct = Math.max(0, Math.min(100, pct)); oldPane.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)'; handle.style.left = pct + '%'; }
  function fromEvent(e){ const r = wrap.getBoundingClientRect(); const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left; setPct(cx / r.width * 100); }
  // drag ONLY by grabbing the handle - the rest of the mock stays clickable
  handle.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); });
  window.addEventListener('mousemove', (e) => { if (dragging) fromEvent(e); });
  window.addEventListener('mouseup', () => dragging = false);
  handle.addEventListener('touchstart', (e) => { dragging = true; }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (dragging) fromEvent(e); }, { passive: true });
  window.addEventListener('touchend', () => dragging = false);
  setPct(50);

  // clickable widget inside the NEW mock
  const mnBubble = document.getElementById('mnBubble');
  const mnChat = document.getElementById('mnChat');
  const mnBody = document.getElementById('mnChatBody');
  if (mnBubble && mnChat) {
    const SCRIPT = {
      ru: [['bot','Здравствуйте! Чем помочь?'],['user','Сколько стоит?'],['bot','Оставьте контакт - пришлю расчёт ✓']],
      en: [['bot','Hi! How can I help?'],['user','How much is it?'],['bot','Leave a contact - I will send a quote ✓']],
    };
    let played = false;
    mnBubble.addEventListener('click', (e) => {
      e.stopPropagation();
      mnChat.classList.toggle('open');
      if (mnChat.classList.contains('open') && !played) {
        played = true;
        const s = SCRIPT[lang] || SCRIPT.ru;
        s.forEach((m, i) => setTimeout(() => {
          const d = document.createElement('div'); d.className = 'msg ' + m[0]; d.textContent = m[1];
          mnBody.appendChild(d); mnBody.scrollTop = mnBody.scrollHeight;
        }, 350 + i * 650));
      }
    });
    mnChat.addEventListener('mousedown', (e) => e.stopPropagation());
  }
})();

// ===== INIT =====
applyLang();
startScene();
scaleLiveFrames();
