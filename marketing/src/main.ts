type Lang = "en" | "sw";

const copy: Record<Lang, Record<string, string>> = {
  en: {
    navLayer: "The layer",
    navPilot: "Pilot",
    navTrust: "Trust",
    navPartners: "Partners",
    navCta: "Talk to us",
    heroTitle: "The behavioral layer inside the systems people already trust.",
    heroLede:
      "We structure income, protect savings, and shape spending habits — then embed that intelligence into SACCOs and banks, starting with Boresha Sacco.",
    ctaPartner: "Partner with us",
    ctaLearn: "See how it works",
    layerEyebrow: "Not another banking app",
    layerTitle: "Infrastructure for better money behavior",
    layerBody:
      "Financial Hub is not competing with SACCOs or banks. The mobile app is our presentation layer — a living demo of the engine. The product is a financial behavioral layer that partners plug into systems members already use.",
    layerCard1Title: "Income before spending",
    layerCard1Body:
      "Money is allocated into purpose-based pockets the moment income arrives — savings protected, essentials settled, spendable amounts made clear.",
    layerCard2Title: "Habits, not spreadsheets",
    layerCard2Body:
      "Discipline scoring, smart nudges, and deliberate friction on risky moves help people change behavior without building a budget by hand.",
    layerCard3Title: "Built to embed",
    layerCard3Body:
      "Long-term: an SDK/API that sits inside SACCO apps, bank apps, and telco super-apps — intelligence without forcing members to switch institutions.",
    pilotEyebrow: "Go-to-market",
    pilotTitle: "Pilot with Boresha Sacco. Scale with institutions after.",
    pilotBody:
      "We start where trust already lives. Boresha Sacco is our first institutional partner path — prove member outcomes, refine the embed model, then expand to other SACCOs and financial institutions.",
    pilotPoint1: "Member-facing behavior engine, institution-owned relationship",
    pilotPoint2: "Showcase app for demos; production path is integration",
    pilotPoint3: "Clear path from pilot metrics to multi-institution rollout",
    pilotPanelLabel: "Pilot path",
    pilotNow: "Now",
    pilotNowDesc: "First institutional pilot",
    pilotNext: "Next",
    pilotNextName: "Other SACCOs",
    pilotLater: "Later",
    pilotLaterName: "Banks & digital finance",
    trustEyebrow: "Origin & IP",
    trustTitle: "Born at Kabarak. Protected with KECOBO.",
    trustBody:
      "Financial Hub is an innovation under Kabarak University. Our intellectual property is registered with KECOBO, with Kabarak as a stakeholder in that IP — academic rigor meeting commercial readiness.",
    ipRef: "KECOBO registration on file — reference available on request",
    trustKabarak: "Innovation home — research, mentorship, and institutional backing for the venture.",
    trustKecobo: "Copyright-protected IP, with Kabarak University as a party to the registration.",
    trustKenyaTitle: "Built for Kenya",
    trustKenya:
      "Designed around real income patterns — salaried, gig, freelancer — and the institutions Kenyans already use.",
    partnersEyebrow: "For partners & investors",
    partnersTitle: "Help us put behavioral finance where money already moves.",
    partnersBody:
      "We are raising attention and capital to move from a presentation-ready showcase to an embeddable layer with institutional pilots. If you build or fund financial infrastructure in East Africa, we want to talk.",
    investorsLabel: "Investors",
    investorsBody: "Fund the path from demo engine → partner SDK → billed institutional deployments.",
    saccosLabel: "SACCOs & banks",
    saccosBody: "Pilot member outcomes without replacing your core banking or mobile app.",
    publicLabel: "Public & press",
    publicBody: "Follow the journey as we prove that better money habits can live inside trusted systems.",
    contactEyebrow: "Contact",
    contactTitle: "Let’s start a conversation",
    contactBody: "Partnerships, pilot interest, or investment — send a note and we’ll follow up.",
    contactPerk1: "SACCO & bank pilots",
    contactPerk2: "Investor conversations",
    contactPerk3: "Press & introductions",
    contactNote:
      "No public domain email yet — your note is copied so you can paste it into WhatsApp, Telegram, or email when you reach out.",
    interestLabel: "I’m reaching out as",
    interestPartner: "Institution",
    interestInvestor: "Investor",
    interestOther: "Other",
    nameLabel: "Name",
    emailLabel: "Email",
    orgLabel: "Organization",
    messageLabel: "Message",
    submitLabel: "Copy message",
    formSuccess: "Message copied — paste it wherever you contact the team.",
    formError: "Please fill in name, email, and message.",
    formCopyFailed: "Couldn’t copy automatically — select and copy the draft below.",
    footerTag: "Behavioral finance layer · Kabarak University innovation",
    footerMeta: "IP registered with KECOBO · Kabarak University stakeholder · Pilot: Boresha Sacco",
    copyright: "© 2026 Financial Hub. All rights reserved.",
  },
  sw: {
    navLayer: "Lango",
    navPilot: "Jaribio",
    navTrust: "Uaminifu",
    navPartners: "Washirika",
    navCta: "Wasiliana nasi",
    heroTitle: "Lango la tabia ndani ya mifumo ambayo watu tayari wanaiamini.",
    heroLede:
      "Tunapanga mapato, kulinda akiba, na kuunda tabia za matumizi — kisha kuingiza akili hiyo katika SACCO na benki, kuanzia na Boresha Sacco.",
    ctaPartner: "Shirikiana nasi",
    ctaLearn: "Angalia jinsi inavyofanya kazi",
    layerEyebrow: "Sio programu nyingine ya benki",
    layerTitle: "Miundombinu ya tabia bora za fedha",
    layerBody:
      "Financial Hub haishindani na SACCO au benki. Programu ya simu ni onyesho letu — demo hai ya injini. Bidhaa ni lango la tabia la kifedha ambalo washirika huingiza katika mifumo wanachama tayari wanaitumia.",
    layerCard1Title: "Mapato kabla ya matumizi",
    layerCard1Body:
      "Pesa hugawanywa katika mifuko yenye madhumuni mapema mapato yanapofika — akiba inalindwa, mahitaji yanashughulikiwa, na kiasi kinachotumika kinaonekana wazi.",
    layerCard2Title: "Tabia, si majedwali",
    layerCard2Body:
      "Alama za nidhamu, arifa mahiri, na msuguano wa makusudi kwenye hatua hatari husaidia watu kubadilisha tabia bila kujenga bajeti kwa mkono.",
    layerCard3Title: "Imejengwa kuingizwa",
    layerCard3Body:
      "Muda mrefu: SDK/API ndani ya programu za SACCO, benki, na telco — akili bila kulazimisha wanachama kubadilisha taasisi.",
    pilotEyebrow: "Soko",
    pilotTitle: "Anza na Boresha Sacco. Kisha panua kwa taasisi nyingine.",
    pilotBody:
      "Tunaanza pale uaminifu upo. Boresha Sacco ni njia yetu ya kwanza ya ushirikiano — thibitisha matokeo kwa wanachama, boresha modeli ya kuingiza, kisha panua kwa SACCO na taasisi nyingine.",
    pilotPoint1: "Injini ya tabia kwa wanachama, uhusiano unabakia kwa taasisi",
    pilotPoint2: "Programu ya onyesho kwa demo; njia ya uzalishaji ni uunganishaji",
    pilotPoint3: "Njia wazi kutoka metriki za jaribio hadi kuenea kwa taasisi nyingi",
    pilotPanelLabel: "Njia ya jaribio",
    pilotNow: "Sasa",
    pilotNowDesc: "Jaribio la kwanza la kitaasisi",
    pilotNext: "Ifuatayo",
    pilotNextName: "SACCO nyingine",
    pilotLater: "Baadaye",
    pilotLaterName: "Benki na fedha dijitali",
    trustEyebrow: "Asili na IP",
    trustTitle: "Imezaliwa Kabarak. Imelindwa na KECOBO.",
    trustBody:
      "Financial Hub ni uvumbuzi chini ya Chuo Kikuu cha Kabarak. Mali yetu miliki imesajiliwa na KECOBO, na Kabarak kama mdau katika IP hiyo — taaluma ikikutana na utayari wa kibiashara.",
    ipRef: "Usajili wa KECOBO upo — nambari inapatikana kwa ombi",
    trustKabarak: "Nyumbani kwa uvumbuzi — utafiti, ushauri, na msaada wa kitaasisi.",
    trustKecobo: "IP iliyolindwa kwa hakimiliki, Chuo Kikuu cha Kabarak kikiwa sehemu ya usajili.",
    trustKenyaTitle: "Imejengwa kwa Kenya",
    trustKenya:
      "Imeundwa kwa mifumo halisi ya mapato — mshahara, gig, freelancer — na taasisi Wakenya tayari wanazitumia.",
    partnersEyebrow: "Kwa washirika na wawekezaji",
    partnersTitle: "Tusaidie kuweka fedha za tabia pale fedha tayari zinapohamia.",
    partnersBody:
      "Tunatafuta umakini na mtaji kuhama kutoka onyesho hadi lango linaloweza kuingizwa na majaribio ya kitaasisi. Ukiunda au kufadhili miundombinu ya fedha Afrika Mashariki, tunataka kuzungumza.",
    investorsLabel: "Wawekezaji",
    investorsBody: "Fadhili njia kutoka injini ya demo → SDK ya washirika → utekelezaji wa kitaasisi.",
    saccosLabel: "SACCO na benki",
    saccosBody: "Jaribu matokeo ya wanachama bila kubadilisha mfumo wako mkuu au programu.",
    publicLabel: "Umma na vyombo vya habari",
    publicBody: "Fuata safari yetu tunapothibitisha kuwa tabia bora za fedha zinaweza kuishi ndani ya mifumo inayoaminika.",
    contactEyebrow: "Mawasiliano",
    contactTitle: "Tuanze mazungumzo",
    contactBody: "Ushirikiano, jaribio, au uwekezaji — andika ujumbe, kisha unakiliwa kwa ajili ya kushiriki.",
    contactPerk1: "Majaribio ya SACCO na benki",
    contactPerk2: "Mazungumzo na wawekezaji",
    contactPerk3: "Vyombo vya habari na utambulisho",
    contactNote:
      "Bado hakuna barua pepe ya umma — ujumbe wako unakiliwa ili uweze kuubandika WhatsApp, Telegram, au barua pepe.",
    interestLabel: "Ninawasiliana kama",
    interestPartner: "Taasisi",
    interestInvestor: "Mwekezaji",
    interestOther: "Nyingine",
    nameLabel: "Jina",
    emailLabel: "Barua pepe",
    orgLabel: "Shirika",
    messageLabel: "Ujumbe",
    submitLabel: "Nakili ujumbe",
    formSuccess: "Ujumbe umenakiliwa — ubandike pale unapowasiliana na timu.",
    formError: "Tafadhali jaza jina, barua pepe, na ujumbe.",
    formCopyFailed: "Imeshindikana kunakili — chagua na unakili rasimu hapa chini.",
    footerTag: "Lango la fedha za tabia · Uvumbuzi wa Chuo Kikuu cha Kabarak",
    footerMeta: "IP imesajiliwa na KECOBO · Mdau: Kabarak · Jaribio: Boresha Sacco",
    copyright: "© 2026 Financial Hub. Haki zote zimehifadhiwa.",
  },
};

let lang: Lang = "en";

function applyTranslations(next: Lang) {
  lang = next;
  document.documentElement.lang = next;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    const value = copy[next][key];
    if (value) el.textContent = value;
  });
  const label = document.getElementById("langLabel");
  if (label) label.textContent = next === "en" ? "Kiswahili" : "English";
  localStorage.setItem("fh-marketing-lang", next);
}

function initReveal() {
  const nodes = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((n) => n.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );
  nodes.forEach((n) => io.observe(n));
}

function setMenuOpen(open: boolean) {
  const toggle = document.getElementById("menuToggle");
  const mobile = document.getElementById("mobileNav");
  if (!toggle || !mobile) return;

  if (open) {
    mobile.removeAttribute("hidden");
    document.body.classList.add("menu-open");
  } else {
    mobile.setAttribute("hidden", "");
    document.body.classList.remove("menu-open");
  }
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}

function initNav() {
  const toggle = document.getElementById("menuToggle");
  const mobile = document.getElementById("mobileNav");
  if (!toggle || !mobile) return;

  toggle.addEventListener("click", () => {
    setMenuOpen(mobile.hasAttribute("hidden"));
  });

  mobile.querySelectorAll("[data-close-menu]").forEach((el) => {
    el.addEventListener("click", () => setMenuOpen(false));
  });

  mobile.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });
}

function initForm() {
  const form = document.getElementById("contactForm") as HTMLFormElement | null;
  const status = document.getElementById("formStatus");
  if (!form || !status) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const organization = String(data.get("organization") || "").trim();
    const message = String(data.get("message") || "").trim();
    const interest = String(data.get("interest") || "partner");

    if (!name || !email || !message) {
      status.textContent = copy[lang].formError;
      status.classList.add("is-error");
      return;
    }

    const draft = [
      "Financial Hub inquiry",
      `Interest: ${interest}`,
      `Name: ${name}`,
      `Email: ${email}`,
      `Organization: ${organization || "—"}`,
      "",
      message,
    ].join("\n");

    status.classList.remove("is-error");
    try {
      await navigator.clipboard.writeText(draft);
      status.textContent = copy[lang].formSuccess;
    } catch {
      status.textContent = copy[lang].formCopyFailed;
      status.classList.add("is-error");
      window.prompt(copy[lang].formCopyFailed, draft);
    }

    console.info("marketing_contact_draft", {
      name,
      email,
      organization,
      interest,
      message,
      lang,
    });
    form.reset();
  });
}

function initLang() {
  const saved = localStorage.getItem("fh-marketing-lang");
  const initial: Lang = saved === "sw" ? "sw" : "en";
  applyTranslations(initial);

  document.getElementById("langToggle")?.addEventListener("click", () => {
    applyTranslations(lang === "en" ? "sw" : "en");
  });
}

initLang();
initReveal();
initNav();
initForm();
