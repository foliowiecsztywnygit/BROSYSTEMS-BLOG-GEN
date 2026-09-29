import OpenAI from 'openai';
import { ClientConfig } from './config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateResult {
  title: string;
  description: string;
  date: string;
  slug: string;
  markdown_content: string;
  // Extended frontmatter fields (B2B full schema)
  metaTitle?: string;
  metaDescription?: string;
  category?: string;
  readTime?: string;
  updatedAt?: string;
  excerpt?: string;
  relatedSlugs?: string[];
  ctaTitle?: string;
  ctaDescription?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

const POLISH_MONTHS_GENITIVE: Record<number, string> = {
  0: 'stycznia', 1: 'lutego', 2: 'marca', 3: 'kwietnia',
  4: 'maja', 5: 'czerwca', 6: 'lipca', 7: 'sierpnia',
  8: 'września', 9: 'października', 10: 'listopada', 11: 'grudnia'
};

const POLISH_MONTHS_NOMINATIVE: Record<number, string> = {
  0: 'styczeń', 1: 'luty', 2: 'marzec', 3: 'kwiecień',
  4: 'maj', 5: 'czerwiec', 6: 'lipiec', 7: 'sierpień',
  8: 'wrzesień', 9: 'październik', 10: 'listopad', 11: 'grudzień'
};

// ─────────────────────────────────────────────────────────────
// SEASONAL CONTEXT ENGINE
// Returns real-world context based on current date
// ─────────────────────────────────────────────────────────────

interface SeasonalContext {
  season: string;
  tourismPhase: string;
  upcomingEvents: string[];
  weatherContext: string;
  guestBehavior: string;
  businessPriority: string;
  contentAngle: string;
}

function getSeasonalContext(date: Date): SeasonalContext {
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // January
  if (month === 0) {
    if (day <= 6) return {
      season: 'zima — szczyt sezonu narciarskiego',
      tourismPhase: 'Pełne obłożenie: ferie świąteczne, Nowy Rok, Trzech Króli',
      upcomingEvents: ['Koniec ferii świątecznych', 'Początek ferii zimowych (różne województwa od połowy stycznia)', 'Puchar Świata w skokach narciarskich Zakopane (styczeń)', 'Wielka Orkiestra Świątecznej Pomocy'],
      weatherContext: 'Śnieg w górach, temperatury -10 do -5°C, idealne warunki narciarskie, krótkie dni',
      guestBehavior: 'Rezerwacje last-minute na ferie, rodziny z dziećmi, grupy narciarskie szukające wolnych terminów',
      businessPriority: 'Maksymalizacja przychodu w szczycie sezonu, upselling (skipass, transport, wyżywienie)',
      contentAngle: 'Jak nie tracić rezerwacji w szczycie sezonu, gdy telefon dzwoni non-stop'
    };
    return {
      season: 'zima — ferie zimowe',
      tourismPhase: 'Ferie zimowe (rotacja województw od stycznia do końca lutego)',
      upcomingEvents: ['Ferie zimowe kolejnych województw', 'Walentynki (14 luty)', 'Puchar Świata w skokach — Zakopane'],
      weatherContext: 'Pełna zima, stabilna pokrywa śnieżna w górach, dzień się wydłuża',
      guestBehavior: 'Rodziny z dziećmi na feriach, pary szukające romantycznych weekendów, narciarze',
      businessPriority: 'Zapełnienie kalendarza między turami ferii, pakiety family-friendly',
      contentAngle: 'Strategie na rotację gości w okresie ferii — jak zapełnić każdy tydzień'
    };
  }

  // February
  if (month === 1) {
    return {
      season: 'zima — koniec ferii zimowych',
      tourismPhase: 'Schyłek ferii, Walentynki, karnawał',
      upcomingEvents: ['Walentynki (14 luty)', 'Ostatki / Tłusty Czwartek', 'Koniec ferii zimowych', 'Pierwsze oznaki przedwiośnia w dolinie'],
      weatherContext: 'Nadal zima, śnieg w górach, ale dni coraz dłuższe. Odwilże w dolinach',
      guestBehavior: 'Pary na Walentynki, ostatnie rodziny na feriach, weekendowicze narciarze',
      businessPriority: 'Walentynkowe pakiety, przygotowanie do luki między-sezonowej marzec-kwiecień',
      contentAngle: 'Jak zarobić na Walentynkach i nie wpaść w martwą strefę po feriach'
    };
  }

  // March
  if (month === 2) {
    return {
      season: 'przedwiośnie — martwy sezon',
      tourismPhase: 'Najsłabszy miesiąc w roku turystycznym, przygotowania do Wielkanocy',
      upcomingEvents: ['Wielkanoc (data ruchoma — marzec/kwiecień)', 'Pierwszy dzień wiosny (21 marca)', 'Otwarcie szlaków po zimie (koniec marca/kwiecień)'],
      weatherContext: 'Śnieg topnieje w dolinach, na szczytach jeszcze warunki narciarskie. Zmienne pogoda. Błoto na szlakach',
      guestBehavior: 'Minimalny ruch, pojedynczy weekendowicze, osoby szukające ciszy. Wielkanocne rezerwacje',
      businessPriority: 'Remonty, aktualizacja strony, przygotowanie oferty na wiosnę i lato, budowa contentu',
      contentAngle: 'Co robić gdy jest pusto — inwestycje w widoczność które zaprocentują w sezonie'
    };
  }

  // April
  if (month === 3) {
    return {
      season: 'wiosna — odżywanie',
      tourismPhase: 'Wielkanoc (jeśli w kwietniu), pierwsze ciepłe weekendy, początek sezonu rowerowego',
      upcomingEvents: ['Wielkanoc (jeśli w kwietniu)', 'Majówka (1-3 maja)', 'Otwarcie szlaków w TPN', 'Rozpoczęcie sezonu rowerowego w Beskidach'],
      weatherContext: 'Temperatury 10-18°C w dolinach, kwitnące krokusy na polanach tatrzańskich, zieleni się',
      guestBehavior: 'Wielkanocne wyjazdy rodzinne, pierwsi turyści piesi, rezerwacje na majówkę (PEAK planowania)',
      businessPriority: 'Zbieranie rezerwacji na majówkę, pakiety wielkanocne, aktualizacja galerii na stronie',
      contentAngle: 'Majówka to test — kto zbiera rezerwacje teraz, ten wygrywa cały sezon'
    };
  }

  // May
  if (month === 4) {
    if (day <= 7) return {
      season: 'wiosna — majówka',
      tourismPhase: 'Majówka — mini-szczyt sezonu, długie weekendy 1-3 maja + weekendy majowe',
      upcomingEvents: ['Majówka (1-3 maja)', 'Dzień Matki (26 maja)', 'Boże Ciało (data ruchoma — maj/czerwiec)', 'Rozpoczęcie sezonu letniego'],
      weatherContext: 'Temperatury 15-22°C, idealna pogoda na górskie wędrówki, bujna zieleń',
      guestBehavior: 'Rodziny na długim weekendzie, pary, grupy przyjaciół. Spontaniczne rezerwacje last-minute',
      businessPriority: 'Maksymalizacja majówki, zbieranie opinii od gości, cross-selling atrakcji',
      contentAngle: 'Dlaczego majówka to Twój barometr — jeśli tu zarabiasz, lato będzie złote'
    };
    return {
      season: 'wiosna — po majówce, rozkręcanie sezonu',
      tourismPhase: 'Spokojne weekendy, ale lato nadchodzi. Długie weekendy (Boże Ciało)',
      upcomingEvents: ['Boże Ciało (data ruchoma)', 'Dzień Dziecka (1 czerwca)', 'Rozpoczęcie wakacji szkolnych (koniec czerwca)'],
      weatherContext: 'Stabilne 18-25°C, długie dni, pełne otwarcie szlaków, kwitnienie łąk górskich',
      guestBehavior: 'Weekendowicze, turyści zagraniczni (Niemcy, Czesi), seniorzy poza szczytem',
      businessPriority: 'Budowanie rezerwacji na lato, oferty na Boże Ciało, podnoszenie widoczności w Google',
      contentAngle: 'Czerwiec startuje za chwilę — Twoja strona jest gotowa czy śpi?'
    };
  }

  // June
  if (month === 5) {
    return {
      season: 'lato — początek sezonu letniego',
      tourismPhase: 'Boże Ciało (jeśli w czerwcu), rozkręcanie sezonu, od ~23 czerwca wakacje szkolne',
      upcomingEvents: ['Boże Ciało (jeśli w czerwcu)', 'Początek wakacji szkolnych (~23 czerwca)', 'Festiwal Folklorystyczny Zakopane', 'Biegi górskie w Tatrach'],
      weatherContext: 'Ciepło 20-28°C, burze popołudniowe w górach, najdłuższe dni w roku',
      guestBehavior: 'Pierwsze rodziny wakacyjne, turyści zagraniczni, rowerzyści, biegacze górski',
      businessPriority: 'Zapełnienie lipca i sierpnia, last-minute na Boże Ciało, budowanie opinii',
      contentAngle: 'Wakacje za progiem — kto ma puste pokoje w lipcu, ten zawalił marketing'
    };
  }

  // July
  if (month === 6) {
    return {
      season: 'lato — pełnia sezonu wakacyjnego',
      tourismPhase: 'Absolutny szczyt sezonu letniego, pełne obłożenie',
      upcomingEvents: ['Festiwal Muzyki Dawnej w Zakopanem', 'Międzynarodowy Festiwal Folkloru Ziem Górskich', 'Biegi ultra-trail w Tatrach', 'Imprezy plenerowe w Beskidach'],
      weatherContext: 'Upały 25-35°C w dolinach, burze w górach, tłumy na szlakach. Pełne stoki rowerowe',
      guestBehavior: 'Rodziny, grupy, turyści zagraniczni. Rezerwacje tygodniowe. Szukanie klimatyzacji, basenu',
      businessPriority: 'Maksymalizacja przychodu, upselling, zbieranie opinii Google, cross-selling atrakcji',
      contentAngle: 'Sezon trwa — czy zarabiasz tyle ile powinieneś, czy połowę oddajesz pośrednikom?'
    };
  }

  // August
  if (month === 7) {
    return {
      season: 'lato — koniec wakacji, żniwa finansowe',
      tourismPhase: 'Ostatnie tygodnie wakacji, goście szukają last-minute, przygotowanie do jesieni',
      upcomingEvents: ['15 sierpnia — Wniebowzięcie (długi weekend)', 'Koniec wakacji szkolnych (~1 września)', 'Dożynki regionalne', 'Wrześniowa złota jesień w górach'],
      weatherContext: 'Wciąż ciepło 22-30°C, ale wieczory chłodniejsze. Najlepszy czas na Tatry — stabilna pogoda',
      guestBehavior: 'Last-minute wakacyjne, pary bez dzieci (koniec sierpnia), przedłużone weekendy 15.08',
      businessPriority: 'Dobijanie letniego sezonu, planowanie jesieni, zbieranie recenzji, przygotowanie ofert zimowych',
      contentAngle: 'Sierpień się kończy — ile zarobiłeś a ile mogłeś zarobić bez pośredników?'
    };
  }

  // September
  if (month === 8) {
    return {
      season: 'jesień — złota polska jesień w górach',
      tourismPhase: 'Koniec wakacji, ale piękna pogoda. Turyści seniorzy, pary, rowerzyści. Weekendowy ruch',
      upcomingEvents: ['Rozpoczęcie roku szkolnego', 'Jesienna paleta barw w Tatrach i Beskidach (przełom wrz/paź)', 'Winobranie w Podkarpaciu', 'Dzień Turystyki (27 września)', 'Przygotowania do sezonu grzybiarskiego'],
      weatherContext: 'Temperatury 12-22°C, sucho i słonecznie, najpiękniejsze kolory w górach, cisza na szlakach',
      guestBehavior: 'Pary, seniorzy, digital nomads. Krótsze pobyty weekendowe. Grzybobranie. Spokój jako wartość',
      businessPriority: 'Oferty jesienne, pakiety midweek, budowa contentu na zimę, naprawa SEO po sezonie',
      contentAngle: 'Jesień to najlepszy moment na naprawę strony — masz czas zanim przyjdzie zima'
    };
  }

  // October
  if (month === 9) {
    return {
      season: 'jesień — schyłek, przygotowanie do zimy',
      tourismPhase: 'Spadek ruchu, ale weekendy wciąż popularne. Halloween/Dziady. Przygotowanie do zimy',
      upcomingEvents: ['Wszystkich Świętych (1 listopada)', 'Halloween / Dziady', 'Zmiana czasu (koniec października)', 'Pierwsze przymrozki w górach', 'Black Friday (koniec listopada)'],
      weatherContext: 'Temperatury 5-15°C, deszczowo, mgły w dolinach, pierwszy śnieg na szczytach',
      guestBehavior: 'Weekendowicze na ostatnią jesień, grzybiarze. Planowanie ferii zimowych i Sylwestra',
      businessPriority: 'Budowa oferty zimowej i sylwestrowej, naprawy/remonty, inwestycja w stronę i SEO',
      contentAngle: 'Za 2 miesiące zaczyna się sezon zimowy — czy Twoja strona jest na to gotowa?'
    };
  }

  // November
  if (month === 10) {
    return {
      season: 'późna jesień — martwy sezon, przygotowanie do zimy',
      tourismPhase: 'Najsłabszy ruch w roku (obok marca). Czas na inwestycje',
      upcomingEvents: ['11 listopada — Dzień Niepodległości (długi weekend)', 'Black Friday / Cyber Monday', 'Rozpoczęcie sezonu narciarskiego (koniec listopada)', 'Sylwester — rezerwacje w toku'],
      weatherContext: 'Zimno 0-8°C, deszcz, mgły, krótkie dni. Pierwsze opady śniegu na stokach',
      guestBehavior: 'Minimalny ruch, długi weekend 11.11. Ludzie planują zimę, Boże Narodzenie, Sylwestra',
      businessPriority: 'Sprzedaż Sylwestra i ferii, aktualizacja strony, budowa widoczności online, inwestycje',
      contentAngle: 'Masz 30 dni zanim telefon zacznie dzwonić — zainwestuj w stronę albo oddaj kasę Bookingowi'
    };
  }

  // December
  return {
    season: 'zima — Boże Narodzenie i Sylwester',
    tourismPhase: 'Szczyt sezonu zimowego: Boże Narodzenie, Sylwester, ferie świąteczne',
    upcomingEvents: ['Jarmarki Bożonarodzeniowe', 'Boże Narodzenie (24-26 grudnia)', 'Sylwester i Nowy Rok', 'Ferie świąteczne', 'Otwarcie stacji narciarskich'],
    weatherContext: 'Śnieg w górach, temperatury -5 do 3°C, atmosfera świąteczna, krótkie dni',
    guestBehavior: 'Rodziny na święta, grupy na Sylwestra, narciarze. Rezerwacje premium, wyższe ceny',
    businessPriority: 'Maksymalizacja stawek, upselling Sylwestra, planowanie ferii zimowych (styczeń-luty)',
    contentAngle: 'Grudniowy przychód decyduje o całym roku — ile z niego zostaje u Ciebie?'
  };
}

// ─────────────────────────────────────────────────────────────
// DIVERSE TOPIC CLUSTERS — 30+ unikatowych tematów
// Grouped so the system never picks 2 from the same cluster
// ─────────────────────────────────────────────────────────────

const B2B_TOPIC_CLUSTERS = [
  // === FINANSE & PROWIZJE ===
  { cluster: 'finanse', topic: 'Jak policzyć prawdziwy koszt pośredników — pełna kalkulacja roczna z ukrytymi opłatami', keywords: ['prowizje booking', 'koszty portali', 'ile kosztuje booking'] },
  { cluster: 'finanse', topic: 'Model abonamentowy vs prowizyjny — który system rezerwacji naprawdę się opłaca', keywords: ['system rezerwacji koszt', 'booking engine cena', 'abonament vs prowizja'] },

  // === MARKETING & WIDOCZNOŚĆ ===
  { cluster: 'marketing-google', topic: 'Google Moja Firma dla obiektów noclegowych — co wpisać, jakie zdjęcia dodać, jak zbierać opinie', keywords: ['google moja firma hotel', 'wizytówka google pensjonat', 'opinie google noclegi'] },
  { cluster: 'marketing-social', topic: 'Reels i krótkie wideo — jak właściciel pensjonatu może nagrywać telefonem i zyskać gości', keywords: ['marketing pensjonat social media', 'reels hotel', 'tiktok agroturystyka'] },
  { cluster: 'marketing-opinie', topic: 'Jak zbierać opinie od gości automatycznie i dlaczego 50 opinii zmienia wszystko', keywords: ['opinie google pensjonat', 'jak zbierać recenzje', 'opinie gości'] },
  { cluster: 'marketing-email', topic: 'Baza mailingowa gości — jak ją budować i wysyłać oferty bez spamu', keywords: ['newsletter pensjonat', 'email marketing noclegi', 'powracający goście'] },

  // === STRONA WWW & TECHNOLOGIA ===
  { cluster: 'strona-zdjecia', topic: 'Zdjęcia na stronie obiektu — czym robić, jak kadrować, co pokazywać a co ukrywać', keywords: ['zdjęcia pensjonatu', 'fotografia noclegi', 'zdjęcia na stronę hotelu'] },
  { cluster: 'strona-mobilna', topic: 'Twoja strona na telefonie — dlaczego 78% gości odchodzi po 3 sekundach i co z tym zrobić', keywords: ['strona mobilna pensjonat', 'szybkość strony hotel', 'mobile first noclegi'] },
  { cluster: 'strona-tresc', topic: 'Co pisać na stronie obiektu — opisy pokoi, regulamin, FAQ, cennik — kompletna checklist', keywords: ['opis obiektu noclegowego', 'strona pensjonatu treść', 'co napisać na stronie hotelu'] },
  { cluster: 'strona-kalendarz', topic: 'Kalendarz dostępności na stronie — jak go wdrożyć i dlaczego zmniejsza liczbę telefonów o 60%', keywords: ['kalendarz rezerwacji na stronę', 'dostępność pokoi online', 'kalendarz pensjonat'] },

  // === OBSŁUGA GOŚCI ===
  { cluster: 'obsluga-automatyzacja', topic: 'Automatyczne potwierdzenia rezerwacji — maile, SMSy i jak to ustawić za 0 zł', keywords: ['automatyzacja rezerwacji', 'potwierdzenie rezerwacji email', 'sms do gości'] },
  { cluster: 'obsluga-checkin', topic: 'Self check-in i zamki kodowe — czy to się sprawdza w polskim pensjonacie?', keywords: ['self check-in pensjonat', 'zamek kodowy noclegi', 'klucz elektroniczny'] },
  { cluster: 'obsluga-problemy', topic: 'Najtrudniejsi goście — jak reagować na roszczenia, late check-out i zniszczenia', keywords: ['trudny gość hotel', 'reklamacje pensjonat', 'zniszczenia w obiekcie'] },

  // === SEZONOWOŚĆ & STRATEGIA ===
  { cluster: 'sezon-zima', topic: 'Przygotowanie obiektu na sezon narciarski — co zrobić przed pierwszym śniegiem', keywords: ['sezon narciarski pensjonat', 'przygotowanie na zimę noclegi', 'obiekt noclegowy zima'] },
  { cluster: 'sezon-lato', topic: 'Wakacje w górach — jak przebić plażowe kurorty i przyciągnąć rodziny', keywords: ['wakacje góry zamiast morze', 'lato w tatrach', 'rodzinne wakacje góry'] },
  { cluster: 'sezon-poza', topic: 'Poza sezonem nie musi być pusto — 7 sposobów na gości w marcu i listopadzie', keywords: ['noclegi poza sezonem', 'goście martwy sezon', 'atrakcje poza sezonem góry'] },
  { cluster: 'sezon-events', topic: 'Lokalne wydarzenia jako magnes na gości — festiwale, zawody, jarmarki w Twoim regionie', keywords: ['wydarzenia lokalne turystyka', 'festiwale góry', 'jarmark bożonarodzeniowy noclegi'] },

  // === KONKURENCJA & RYNEK ===
  { cluster: 'rynek-airbnb', topic: 'Airbnb w polskich górach — kto tam rezerwuje i jak z nich korzystać bez oddawania 15%', keywords: ['airbnb polska góry', 'airbnb vs własna strona', 'airbnb prowizje'] },
  { cluster: 'rynek-trendy', topic: 'Nowe trendy w turystyce górskiej — workation, digital nomads, slow travel', keywords: ['workation góry', 'digital nomad pensjonat', 'slow travel tatry'] },
  { cluster: 'rynek-ceny', topic: 'Polityka cenowa — kiedy podnosić, kiedy obniżać, i dlaczego stała cena to błąd', keywords: ['cennik pensjonat', 'dynamic pricing hotel', 'kiedy podnieść ceny noclegi'] },
  { cluster: 'rynek-nowi', topic: 'Pierwszy rok z obiektem noclegowym — 10 lekcji których nikt Ci nie powie', keywords: ['jak otworzyć pensjonat', 'agroturystyka jak zacząć', 'obiekt noclegowy poradnik'] },

  // === PRAWO & FORMALNOŚCI ===
  { cluster: 'prawo-podatki', topic: 'Podatki od najmu krótkoterminowego — ryczałt, VAT, kasa fiskalna: co musisz wiedzieć', keywords: ['podatek wynajem krótkoterminowy', 'ryczałt agroturystyka', 'kasa fiskalna pensjonat'] },
  { cluster: 'prawo-regulamin', topic: 'Regulamin obiektu, RODO i polityka prywatności — jak to napisać żeby się zabezpieczyć', keywords: ['regulamin pensjonatu', 'rodo hotel', 'polityka prywatności noclegi'] },

  // === LOKALNE KNOW-HOW ===
  { cluster: 'lokalne-podhale', topic: 'Podhale vs Beskidy — dwa różne rynki noclegowe, dwie różne strategie', keywords: ['noclegi podhale', 'noclegi beskidy', 'turystyka zakopane vs szczyrk'] },
  { cluster: 'lokalne-transport', topic: 'Dojazd gości — parkowanie, transfer, komunikacja lokalna — jak to ogarnąć na stronie', keywords: ['parking pensjonat', 'dojazd do obiektu', 'transport turystyczny góry'] },
  { cluster: 'lokalne-wspolupraca', topic: 'Współpraca z lokalnymi firmami — wypożyczalnie, przewodnicy, restauracje — jak budować sieć', keywords: ['współpraca turystyka lokalna', 'partnerzy obiekt noclegowy', 'atrakcje lokalne noclegi'] },

  // === CASE STUDIES (fikcyjne ale realistyczne) ===
  { cluster: 'case-booking-odejscie', topic: 'Jak Marek z Białki przeszedł z 90% Bookingu na 60% rezerwacji bezpośrednich w 8 miesięcy', keywords: ['odejście od booking', 'rezerwacje bezpośrednie', 'jak zmniejszyć zależność od portali'] },
  { cluster: 'case-strona-remont', topic: 'Anna z Kościeliska wydała 3000 zł na nową stronę i zarobiła 47 000 zł więcej w sezonie', keywords: ['nowa strona pensjonat', 'zwrot z inwestycji strona', 'ile kosztuje strona pensjonatu'] },
  { cluster: 'case-automatyzacja', topic: 'Jak Tomek z Murzasichla oszczędza 12 godzin tygodniowo dzięki prostemu kalendarzowi online', keywords: ['automatyzacja pensjonat', 'oszczędność czasu noclegi', 'kalendarz online obiekt'] },
];

// ─────────────────────────────────────────────────────────────
// DIVERSE ARTICLE FORMATS — 12 formatów z jasną instrukcją
// ─────────────────────────────────────────────────────────────

const B2B_FORMATS = [
  {
    name: 'Poradnik krok-po-kroku',
    instruction: 'Napisz artykuł jako poradnik z konkretnymi krokami (5-7 kroków). Każdy krok to osobna sekcja H2. Przy każdym kroku podaj: co dokładnie zrobić, ile to kosztuje/oszczędza, ile czasu zajmie. Numeruj kroki w nagłówkach.',
    titlePattern: 'Użyj jednego z wzorców: "X kroków do...", "Jak [osiągnąć cel] — praktyczny poradnik", "Kompletny przewodnik po [temat]"'
  },
  {
    name: 'Case study',
    instruction: 'Napisz artykuł jako historię konkretnego (fikcyjnego ale realistycznego) właściciela obiektu. Nadaj mu imię, lokalizację, typ obiektu. Opisz: sytuację PRZED (z liczbami), co dokładnie zmienił, wyniki PO (z liczbami). Użyj cytatów, dialogów, konkretnych dat.',
    titlePattern: 'Użyj jednego z wzorców: "Jak [Imię] z [Miejscowość] [osiągnął wynik]", "Historia [Imię]: od [problem] do [sukces]", "[Imię] opowiada: [cytat]"'
  },
  {
    name: 'Porównanie',
    instruction: 'Porównaj dwa podejścia, narzędzia lub strategie w formie uczciwej analizy. Użyj tabelki Markdown do porównania 6-8 parametrów. Pod tabelą rozwiń każdy parametr. Podaj konkretne koszty w PLN. Zakończ jasną rekomendacją "dla kogo co".',
    titlePattern: 'Użyj wzorca: "[A] vs [B] — co naprawdę się opłaca w [rok]", "Porównanie [A] i [B] dla [grupy]", "[A] czy [B]? Uczciwe zestawienie"'
  },
  {
    name: 'Checklist',
    instruction: 'Napisz artykuł jako checklistę/listę kontrolną z 8-12 punktami. Każdy punkt to sekcja H2 z checkbox emoji (☐ lub ✅). Rozwiń każdy punkt na 2-3 akapity z praktycznymi wskazówkami. Na końcu podsumuj ile punktów typowy właściciel odhacza.',
    titlePattern: 'Użyj wzorca: "X rzeczy które musisz [zrobić/sprawdzić] przed [wydarzenie/sezon]", "Checklist: [temat] — [liczba] punktów", "Czy Twój obiekt jest gotowy? [liczba] pytań kontrolnych"'
  },
  {
    name: 'FAQ',
    instruction: 'Napisz artykuł jako 8-10 najczęstszych pytań i odpowiedzi. Każde pytanie to nagłówek H2 w formie pytania (tak jak zapytałby właściciel pensjonatu). Odpowiedzi muszą być konkretne — z liczbami, przykładami z branży, kalkulacjami.',
    titlePattern: 'Użyj wzorca: "[Temat] — X pytań które zadaje każdy właściciel obiektu", "Wszystko co musisz wiedzieć o [temat]", "Odpowiedzi na [temat] których nikt Ci nie da"'
  },
  {
    name: 'Analiza rynku',
    instruction: 'Napisz artykuł analizujący konkretny trend lub zjawisko na rynku noclegowym. Podaj szacunkowe dane, procenty, trendy wzrostowe/spadkowe. Pokaż co to oznacza dla portfela właściciela obiektu. Zakończ konkretnymi wnioskami i działaniami.',
    titlePattern: 'Użyj wzorca: "[Zjawisko] zmienia rynek noclegowy — co to oznacza dla Ciebie", "Raport: [temat] w [rok/sezon]", "Dane nie kłamią: [temat] w liczbach"'
  },
  {
    name: 'Poradnik sezonowy',
    instruction: 'Napisz artykuł skupiony na KONKRETNYM nadchodzącym sezonie/wydarzeniu i co właściciel powinien TERAZ robić. Podaj terminarz działań z datami. Każde działanie z szacowanym kosztem i zwrotem.',
    titlePattern: 'Użyj wzorca: "[Wydarzenie/Sezon] za X dni — czy Twój obiekt jest gotowy?", "Kalendarz właściciela: co robić w [miesiąc]", "[Sezon] nadchodzi — plan działania na [X] tygodni"'
  },
  {
    name: 'Błędy do unikania',
    instruction: 'Napisz artykuł o 6-8 najczęstszych błędach właścicieli obiektów w konkretnym obszarze. Każdy błąd to sekcja H2. Opisz: co robią źle, dlaczego to kosztuje, jak to naprawić. Podaj konkretne kwoty strat.',
    titlePattern: 'Użyj wzorca: "[Liczba] błędów które kosztują właścicieli pensjonatów tysiące złotych", "Przestań [robić X] — dlaczego to niszczy Twoją marżę", "Największe pomyłki właścicieli obiektów w [temat]"'
  },
  {
    name: 'Kalkulator / Symulacja finansowa',
    instruction: 'Napisz artykuł zbudowany wokół szczegółowej kalkulacji finansowej. Stwórz 2-3 scenariusze (mały obiekt, średni, duży) z tabelkami Markdown. Pokaż przychody, koszty, marże. Porównaj scenariusz "z" i "bez" danego rozwiązania.',
    titlePattern: 'Użyj wzorca: "Policz sam: ile [zyskujesz/tracisz] na [temat]", "Kalkulacja: [temat] — 3 scenariusze, twarde liczby", "Matematyka nie kłamie: [temat] w [rok]"'
  },
  {
    name: 'Interview / Rozmowa z ekspertem',
    instruction: 'Napisz artykuł w formie fikcyjnego (ale realistycznego) wywiadu. Możesz "rozmawiać" z: doświadczonym właścicielem obiektu, marketingowcem turystycznym, lub fotografem. Format: pytanie (pogrubione) → odpowiedź (2-3 akapity).',
    titlePattern: 'Użyj wzorca: "Rozmowa z [Imię]: [cytat lub temat]", "[Imię] mówi wprost: [cytat]", "Wywiad: [temat] oczami [rola]"'
  },
  {
    name: 'Historia branży / Perspektywa',
    instruction: 'Napisz artykuł pokazujący jak zmieniła się branża noclegowa w ostatnich 5-10 latach i dokąd zmierza. Pokaż transformację: od zeszytów i tablic → przez portale → do własnych stron. Co to oznacza dla właściciela w [bieżący rok].',
    titlePattern: 'Użyj wzorca: "Od zeszytu do [temat]: jak zmienił się rynek noclegowy", "[Rok] vs [Rok] — co się zmieniło w branży noclegowej", "Przyszłość rezerwacji: co czeka właścicieli obiektów"'
  },
  {
    name: 'Przewodnik narzędziowy',
    instruction: 'Napisz artykuł przeglądający 4-6 konkretnych narzędzi/rozwiązań dla właścicieli obiektów. Dla każdego: co robi, ile kosztuje, dla kogo, ocena 1-5. Użyj tabelki podsumowującej. Bądź uczciwy — pokaż wady i zalety.',
    titlePattern: 'Użyj wzorca: "[Liczba] narzędzi które ułatwią życie właścicielowi [typu obiektu]", "Przegląd: [kategoria narzędzi] — co wybrać w [rok]", "Jakie narzędzia naprawdę pomagają w prowadzeniu [typ obiektu]?"'
  },
];

// ─────────────────────────────────────────────────────────────
// TITLE FORMULA DIVERSITY — Zakazane wzorce + nowe alternatywy
// ─────────────────────────────────────────────────────────────

const BANNED_TITLE_PATTERNS = [
  'Ile kosztują Cię',
  'Ile tracisz',
  'Ile kosztuje Cię',
  'Ile pieniędzy tracisz',
  'Ile kosztuje Cię brak',
  'Ile Cię kosztuje',
  'X Sposobów na',
  'X Kluczowych Elementów',
  'X Kroków do',
  'Jak Zoptymalizować',
  'Dlaczego Strona Responsywna',
];

// ─────────────────────────────────────────────────────────────
// SMART TOPIC SELECTION — uses hash + history to avoid repeats
// ─────────────────────────────────────────────────────────────

function selectTopicAndFormat(pastTopics: string[], date: Date): { topic: typeof B2B_TOPIC_CLUSTERS[0], format: typeof B2B_FORMATS[0] } {
  // Filter out topics whose cluster has been recently used
  const recentTitles = pastTopics.join(' ').toLowerCase();

  // Score each topic by how "fresh" it is
  const scoredTopics = B2B_TOPIC_CLUSTERS.map(topic => {
    let score = 100;

    // Check if any keyword appears in recent titles
    for (const kw of topic.keywords) {
      if (recentTitles.includes(kw.toLowerCase())) {
        score -= 30;
      }
    }

    // Check if topic words appear in recent titles
    const topicWords = topic.topic.toLowerCase().split(' ').filter(w => w.length > 4);
    for (const word of topicWords) {
      if (recentTitles.includes(word)) {
        score -= 5;
      }
    }

    // Check cluster — penalize heavily if cluster was recently used
    for (const pastTitle of pastTopics) {
      const clusterTopics = B2B_TOPIC_CLUSTERS.filter(t => t.cluster === topic.cluster);
      for (const ct of clusterTopics) {
        const ctWords = ct.topic.toLowerCase().split(' ').filter(w => w.length > 5);
        const matchCount = ctWords.filter(w => pastTitle.toLowerCase().includes(w)).length;
        if (matchCount >= 2) {
          score -= 20;
        }
      }
    }

    // Add small random factor based on date to avoid determinism
    const dateHash = (date.getDate() * 31 + date.getMonth() * 7 + date.getFullYear()) % 20;
    score += dateHash;

    return { topic, score };
  });

  // Sort by score descending, pick top one
  scoredTopics.sort((a, b) => b.score - a.score);
  const selectedTopic = scoredTopics[0].topic;

  // Select format — avoid recent formats
  const formatHash = (date.getDate() * 13 + date.getMonth() * 37 + pastTopics.length * 7) % B2B_FORMATS.length;
  const selectedFormat = B2B_FORMATS[formatHash];

  return { topic: selectedTopic, format: selectedFormat };
}

// ─────────────────────────────────────────────────────────────
// MAIN GENERATION FUNCTION
// ─────────────────────────────────────────────────────────────

export async function generateContent(client: ClientConfig, pastTopics: string[]): Promise<GenerateResult> {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const month = now.toLocaleString('pl-PL', { month: 'long' });
  const year = now.getFullYear();
  const day = now.getDate();
  const polishDate = `${day} ${POLISH_MONTHS_GENITIVE[now.getMonth()]} ${year}`;
  const monthName = POLISH_MONTHS_NOMINATIVE[now.getMonth()];

  const isB2B = client.clientId === 'brosystems' || client.clientType.toLowerCase().includes('b2b');

  let systemPrompt = '';
  let userPrompt = '';

  if (isB2B) {
    // Get seasonal context
    const seasonal = getSeasonalContext(now);

    // Smart topic & format selection
    const { topic: selectedTopic, format: selectedFormat } = selectTopicAndFormat(pastTopics, now);

    console.log(`[OpenAI] B2B selection — Topic: "${selectedTopic.topic}" (cluster: ${selectedTopic.cluster}), Format: "${selectedFormat.name}"`);

    systemPrompt = `Jesteś doświadczonym dziennikarzem branżowym i doradcą biznesowym specjalizującym się w polskim rynku noclegowym. Piszesz dla firmy "${client.clientName}".
Rynek docelowy: ${client.location}.

## TWOJA ROLA
Nie jesteś copywriterem który produkuje byle jakie treści. Jesteś ekspertem, który:
- Zna realia polskiego rynku noclegowego od podszewki
- Operuje konkretnymi liczbami, stawkami, marżami
- Pisze artykuły które właściciele pensjonatów CHCĄ czytać bo wyciągają z nich wartość
- Buduje autorytet firmy ${client.clientName} jako wiarygodnego partnera

## FIRMA
- Nazwa: ${client.clientName}
- Profil: ${client.clientType}
- Kluczowe kompetencje: ${client.attractionsList.join(', ')}

## AKTUALNY KONTEKST — ${day} ${monthName} ${year}
- **Sezon:** ${seasonal.season}
- **Faza turystyczna:** ${seasonal.tourismPhase}
- **Nadchodzące wydarzenia:** ${seasonal.upcomingEvents.join(', ')}
- **Pogoda:** ${seasonal.weatherContext}
- **Zachowanie gości:** ${seasonal.guestBehavior}
- **Priorytet biznesowy:** ${seasonal.businessPriority}

Wpleć ten kontekst NATURALNIE w artykuł — nie wymieniaj go jako listy, ale niech czytelnik czuje że artykuł jest pisany TERAZ, w tym konkretnym momencie roku.

## ABSOLUTNE ZAKAZY — ŁAMANIE = ODRZUCENIE

### Zakazane wzorce tytułów
${BANNED_TITLE_PATTERNS.map(p => `- NIGDY: "${p}..."`).join('\n')}
- NIGDY nie twórz wariantów tego samego artykułu z podmienioną miejscowością
- NIGDY nie zaczynaj tytułu od pytania "Ile..."

### Zakazane słowa i wyrażenia
- CAŁKOWITY ZAKAZ: "OTA", "SEO", "konwersja", "responsywność", "channel manager", "API", "optymalizacja", "silnik rezerwacji", "UX", "landing page", "funnel", "CTR", "bounce rate", "ROI"
- Zamiast żargonu technicznego używaj języka właściciela pensjonatu:
  * "OTA" → "Booking", "portale rezerwacyjne", "pośrednicy"
  * "konwersja" → "więcej gości rezerwuje", "ludzie częściej klikają Rezerwuj"
  * "responsywna" → "strona która dobrze działa na telefonie"
  * "optymalizacja" → "poprawa", "dopracowanie"
  * "ROI" → "zwrot z inwestycji", "ile to zarobi vs ile kosztuje"
- Słowa codzienne: "puste pokoje", "prowizje", "telefony w weekend", "faktury od Bookingu", "marża", "zaliczki", "goście"

### Zakazany styl
- ZERO lania wody: żadnych "W dzisiejszych czasach...", "Nie jest tajemnicą...", "Jak wiadomo..."
- ZERO pustych obietnic bez liczb
- ZERO generycznych porad bez kontekstu finansowego
- NIGDY nie kończ akapitu na ogólnikach — zawsze podaj liczbę, kwotę, procent lub konkretny przykład

## FORMAT ARTYKUŁU: ${selectedFormat.name}
${selectedFormat.instruction}

### Wzorzec tytułu:
${selectedFormat.titlePattern}

## WYMAGANIA JAKOŚCIOWE

### Długość: MINIMUM 1000 SŁÓW, OPTYMALNIE 1200-1500
Artykuły poniżej 1000 słów będą odrzucane. Licz realne słowa w markdown_content.

### Konkretne dane liczbowe (OBOWIĄZKOWE w KAŻDYM artykule)
- MINIMUM 4 kalkulacje finansowe z kwotami w PLN
- Przykład DOBREJ kalkulacji: "10 pokoi × 280 zł/noc × 70% obłożenia × 90 dni sezonu = 176 400 zł przychodu. Booking zabiera 15% = 26 460 zł. Z własną stroną i prowizją 0% — ta kwota zostaje u Ciebie."
- Przykład ZŁEJ kalkulacji: "Tracisz dużo pieniędzy" (BRAK KWOT = ODRZUCENIE)

### Ton i styl
- Bezpośredni, konkretny, profesjonalny ale nie korporacyjny
- Pisz jak mądry znajomy który prowadzi własny biznes noclegowy od 10 lat
- Krótkie zdania (8-12 słów) przemieszane z dłuższymi (20-25 słów)
- Osobiste obserwacje: "Widzę to u moich klientów...", "Z doświadczenia wiem, że..."
- Wplataj rynek docelowy (${client.location}) naturalnie w co najmniej 2 nagłówkach H2

### Struktura Markdown
- Wstęp: 3-4 mocne zdania BEZ nagłówka. Wciągnij czytelnika od pierwszego zdania
- Treść: 5-8 sekcji z nagłówkami H2 (##). Każda sekcja min. 120 słów
- W sekcjach używaj: **pogrubień**, list punktowanych, tabelek Markdown
- Podsekcje z H3 (###) tam gdzie to naturalne
- Podsumowanie: 3-4 zdania ze wnioskami + jedno pytanie retoryczne
- CTA na końcu — WYŁĄCZNIE w Markdown:

**[Tekst zachęty do działania →](/oferta)**

*Autor: Krzysztof Żebrowski*

## ISTNIEJĄCE ARTYKUŁY — NIE POWTARZAJ SIĘ POD ŻADNYM POZOREM
Poniżej lista WSZYSTKICH dotychczasowych artykułów. Twój nowy artykuł MUSI być inny:
- Inny temat
- Inny kąt podejścia (angle)
- Inna struktura tytułu
- Inne przykłady i kalkulacje
${pastTopics.length > 0 ? pastTopics.map(t => `- "${t}"`).join('\n') : "Brak wcześniejszych artykułów — to pierwszy!"}

## FORMAT ODPOWIEDZI — WYŁĄCZNIE JSON
{
  "title": "Tytuł artykułu (max 70 znaków, chwytliwy, UNIKATOWY, NIGDY nie zaczynaj od 'Ile...')",
  "metaTitle": "Tytuł SEO max 60 znaków z '| ${client.clientName}' na końcu",
  "metaDescription": "Meta opis max 155 znaków, język korzyści, zachęcający do kliknięcia",
  "description": "Identyczny jak metaDescription",
  "date": "${currentDate}",
  "slug": "slug-url-bez-polskich-znakow-max-6-slow",
  "category": "Jedna z: Zarabianie na wynajmie | Marketing obiektów | Technologia | Porady biznesowe | Sezon i strategia | Prawo i formalności",
  "readTime": "X min (oszacuj na podstawie długości)",
  "updatedAt": "${polishDate}",
  "excerpt": "2-3 zdania zachęty, max 200 znaków",
  "relatedSlugs": [],
  "ctaTitle": "Krótki, mocny nagłówek CTA",
  "ctaDescription": "1-2 zdania zachęty",
  "ctaLabel": "Tekst przycisku CTA",
  "ctaHref": "/oferta",
  "markdown_content": "Pełna treść artykułu w Markdown (BEZ frontmatter YAML, BEZ surowego HTML, MINIMUM 1000 słów)"
}`;

    userPrompt = `Napisz obszerny, wartościowy artykuł B2B w formacie "${selectedFormat.name}".

TEMAT PRZEWODNI: "${selectedTopic.topic}"
KLASTER TEMATYCZNY: ${selectedTopic.cluster}
SŁOWA KLUCZOWE DO NATURALNEGO WPLECENIA: ${selectedTopic.keywords.join(', ')}

KONTEKST CZASOWY:
- Data: ${day} ${monthName} ${year}
- Sezon: ${seasonal.season}
- Co się teraz dzieje: ${seasonal.tourismPhase}
- Nadchodzące: ${seasonal.upcomingEvents.join(', ')}
- Angle artykułu: ${seasonal.contentAngle}

TWARDE WYMAGANIA:
1. MINIMUM 1000 słów wartościowej treści (celuj w 1200-1500)
2. MINIMUM 4 konkretne kalkulacje finansowe z kwotami PLN
3. Format: ${selectedFormat.name} — trzymaj się jego struktury
4. Wzorzec tytułu: ${selectedFormat.titlePattern}
5. NIGDY nie zaczynaj tytułu od "Ile kosztują Cię..." ani "Ile tracisz..."
6. CTA wyłącznie w Markdown, NIGDY w HTML
7. Data do JSON: ${currentDate} (format YYYY-MM-DD)

PAMIĘTAJ: Ten artykuł ma budować autorytet domeny, nie ją niszczyć. Jakość > ilość.`;

  } else {
    // ─────────────────────────────────────────────────────────
    // B2C (Obiekty noclegowe) — też ulepszony prompt
    // ─────────────────────────────────────────────────────────
    const seasonal = getSeasonalContext(now);

    systemPrompt = `Jesteś prawdziwą osobą — prowadzisz obiekt noclegowy "${client.clientName}" w lokalizacji: ${client.location}.
Piszesz artykuły na bloga swojego obiektu. Piszesz po polsku, naturalnym, ludzkim językiem — tak jak pisałby właściciel pensjonatu/domku, który kocha swoje miejsce i chce się podzielić wiedzą z gośćmi.

## KIM JESTEŚ
- Właściciel/ka obiektu: ${client.clientName}
- Typ obiektu: ${client.clientType}
- Lokalizacja: ${client.location}
- Atrakcje w pobliżu: ${client.attractionsList.join(', ')}

## AKTUALNY KONTEKST — ${day} ${monthName} ${year}
- **Sezon:** ${seasonal.season}
- **Pogoda:** ${seasonal.weatherContext}
- **Nadchodzące:** ${seasonal.upcomingEvents.join(', ')}
- **Co robią goście:** ${seasonal.guestBehavior}

## ZASADY PISANIA

### Ton i styl
- Pisz jakbyś opowiadał(a) znajomemu. Ciepło, z entuzjazmem, bez przesady.
- NIGDY korporacyjnym, sztucznym językiem.
- Zamiast "nasz obiekt oferuje panoramiczny widok" → "z tarasu widać całą grań Tatr — rano przy kawie ten widok to najlepszy start dnia"
- Krótkie zdania + dłuższe. Naturalny rytm.
- Wplataj osobiste obserwacje: "Co roku widzę, jak...", "Goście często pytają o..."

### Treść i tematyka
- KONKRETNY temat — nie ogólniki. Np. konkretny szlak, wydarzenie, restauracja, atrakcja.
- Uwzględnij SEZON: ${seasonal.season}
- PRAWDZIWE lokalne detale: nazwy szlaków, schronisk, restauracji, dystanse, czas przejścia
- Praktyczne porady: co zabrać, kiedy jechać, na co uważać, ile kosztuje

### SEO — subtelnie
- Frazy: ${client.keywords.join(', ')}
- Wpleć NATURALNIE — czytelnik nie może zauważyć SEO

### Struktura
- Tytuł: chwytliwy, konkretny, brzmi naturalnie
- Wstęp: 2-3 zdania na luzie
- Treść: 4-6 sekcji H2 z wartością
- Zakończenie: krótkie, naturalne
- Markdown: ## H2, ### H3, **pogrubienia**, listy
- Długość: 800-1200 słów

### CZEGO UNIKAĆ
- "niezapomniane wrażenia", "wyjątkowa atmosfera", "komfortowy wypoczynek", "idealne miejsce", "nie bez powodu", "perła regionu", "raj dla..."
- "Czy wiesz, że..." (brzmi jak reklama)
- Nadmiernych wykrzykników
- Pustego marketingu

## NIE POWTARZAJ SIĘ
${pastTopics.length > 0 ? pastTopics.map(t => `- "${t}"`).join('\n') : "Brak wcześniejszych artykułów — to pierwszy!"}

## FORMAT — WYŁĄCZNIE JSON
{
  "title": "Tytuł artykułu",
  "description": "Meta description max 155 znaków",
  "date": "${currentDate}",
  "slug": "slug-url-na-podstawie-tytulu",
  "markdown_content": "Treść w Markdown (bez frontmatter), 800-1200 słów"
}`;

    userPrompt = `Napisz nowy artykuł na bloga. Jest ${day} ${monthName} ${year}.

KONTEKST SEZONOWY:
- ${seasonal.season}
- Pogoda: ${seasonal.weatherContext}
- Co się dzieje: ${seasonal.tourismPhase}
- Nadchodzące: ${seasonal.upcomingEvents.join(', ')}
- Goście szukają: ${seasonal.guestBehavior}

Wymyśl temat który jest:
1. Związany z AKTUALNYM sezonem i tym co się teraz dzieje
2. KONKRETNY — nie ogólny (np. konkretny szlak, wydarzenie, miejsce)
3. INNY niż wszystkie poprzednie artykuły
4. Długość: 800-1200 słów
5. Z prawdziwymi lokalnymi detalami`;
  }

  console.log(`[OpenAI] Generating ${isB2B ? 'B2B' : 'B2C'} article for ${client.clientId}, past topics: ${pastTopics.length}`);

  // Use gpt-4.1 for much better instruction following and longer content
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
    max_tokens: 16384,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const result = JSON.parse(content) as GenerateResult;

  // ─── POST-GENERATION VALIDATION ───
  const wordCount = result.markdown_content.split(/\s+/).filter(w => w.length > 0).length;
  console.log(`[OpenAI] Generated: "${result.title}" (${result.slug}) — ${wordCount} words`);

  // Validate minimum word count
  if (wordCount < 700) {
    console.warn(`[OpenAI] WARNING: Article only has ${wordCount} words (minimum 700). Attempting regeneration...`);
    // Retry once with explicit length instruction
    const retryCompletion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
        { role: "assistant", content: content },
        { role: "user", content: `UWAGA: Ten artykuł ma tylko ${wordCount} słów. To ZA MAŁO. Przepisz go — potrzebuję MINIMUM 1000 słów wartościowej treści. Rozwiń każdą sekcję, dodaj więcej przykładów, kalkulacji i praktycznych porad. Odpowiedz WYŁĄCZNIE pełnym obiektem JSON z nową, dłuższą wersją.` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 16384,
    });

    const retryContent = retryCompletion.choices[0].message.content;
    if (retryContent) {
      const retryResult = JSON.parse(retryContent) as GenerateResult;
      const retryWordCount = retryResult.markdown_content.split(/\s+/).filter(w => w.length > 0).length;
      console.log(`[OpenAI] Retry generated: "${retryResult.title}" — ${retryWordCount} words`);
      if (retryWordCount > wordCount) {
        return retryResult;
      }
    }
  }

  // Validate title doesn't match banned patterns
  const titleLower = result.title.toLowerCase();
  for (const banned of BANNED_TITLE_PATTERNS) {
    if (titleLower.includes(banned.toLowerCase())) {
      console.warn(`[OpenAI] WARNING: Title "${result.title}" matches banned pattern "${banned}". This will be published but flagged.`);
    }
  }

  return result;
}
