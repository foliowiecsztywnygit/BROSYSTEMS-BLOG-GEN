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

const B2B_FORMATS = [
  {
    name: 'Poradnik krok-po-kroku',
    instruction: 'Napisz artykuł w formie poradnika. Tytuł powinien sugerować konkretne kroki (np. "Jak w 5 krokach odzyskać kontrolę nad rezerwacjami"). Każdy krok = osobna sekcja H2 z konkretnym działaniem. Na końcu każdego kroku podaj szacowany efekt finansowy.'
  },
  {
    name: 'Case study / Historia sukcesu',
    instruction: 'Napisz artykuł jako historię konkretnego (fikcyjnego, ale realistycznego) właściciela obiektu noclegowego. Podaj imię, typ obiektu, lokalizację. Opisz problem PRZED zmianą, co dokładnie zrobił, i wyniki PO — z konkretnymi liczbami: przychód, oszczędności, czas. Używaj cytatów i dialogów.'
  },
  {
    name: 'Porównanie dwóch podejść',
    instruction: 'Napisz artykuł porównujący dwa podejścia, narzędzia lub strategie (np. "Booking vs własna strona — co naprawdę się opłaca"). Użyj tabelki Markdown do porównania kluczowych parametrów. Podaj za i przeciw każdego podejścia, z konkretnymi kosztami i korzyściami w PLN.'
  },
  {
    name: 'Checklist / Lista kontrolna',
    instruction: 'Napisz artykuł jako listę kontrolną. Tytuł powinien sugerować konkretną liczbę punktów (np. "9 rzeczy, które musisz sprawdzić na swojej stronie przed sezonem"). Każdy punkt = sekcja H2. Rozwiń każdy punkt na 2-3 akapity z praktycznymi wskazówkami.'
  },
  {
    name: 'FAQ — Pytania i odpowiedzi',
    instruction: 'Napisz artykuł jako zbiór 7-10 najczęściej zadawanych pytań od właścicieli obiektów noclegowych. Każde pytanie = nagłówek H2 w formie pytania. Odpowiedzi muszą być konkretne, z liczbami, przykładami i kalkulacjami.'
  },
  {
    name: 'Analiza rynku z danymi',
    instruction: 'Napisz artykuł analizujący aktualną sytuację na rynku noclegowym. Podaj trendy, szacunkowe liczby, prognozy na nadchodzący sezon. Pokaż jak te trendy wpływają na portfel właściciela obiektu. Używaj konkretnych kwot i procentów.'
  },
  {
    name: 'Poradnik sezonowy',
    instruction: 'Napisz artykuł skupiony na aktualnym sezonie i tym, co właściciel powinien TERAZ robić, żeby maksymalizować zysk. Podaj konkretne działania z terminami i oczekiwanymi rezultatami finansowymi. Uwzględnij specyfikę regionu.'
  },
];

const B2B_TOPICS = [
  'Znaczenie szybkiej i nowoczesnej strony internetowej dla budowania zaufania gości',
  'Mobilna wersja strony – dlaczego większość gości rezerwuje przez telefon i jak tego nie zepsuć',
  'Jak wykorzystać lokalne SEO, by turysta znalazł Twój obiekt szybciej niż na portalach',
  'Automatyzacja procesów – jak mądry kalendarz rezerwacji oszczędza godziny Twojego czasu',
  'Sprzedaż pakietów pobytowych i ofert poza sezonem głównym – budowa lojalności gości',
  'Zdjęcia i prezentacja oferty na stronie – jak pokazać wartość obiektu, by gość nie patrzył tylko na cenę',
  'Budowanie marki własnego obiektu – jak przestać być tylko kolejnym domkiem z listy na portalu',
  'Psychologia rezerwacji – co sprawia, że gość ufa Twojej stronie i klika "Rezerwuj"',
  'Bezpieczeństwo, szybkie płatności i jasne zasady – dlaczego goście porzucają koszyk i jak temu zapobiec',
  'Blog i aktualności – jak pisać o atrakcjach regionu, żeby ściągać darmowy ruch z wyszukiwarki'
];

export async function generateContent(client: ClientConfig, pastTopics: string[]): Promise<GenerateResult> {
  const currentDate = new Date().toISOString().split('T')[0];
  const month = new Date().toLocaleString('pl-PL', { month: 'long' });
  const year = new Date().getFullYear();
  const polishDate = `${new Date().getDate()} ${POLISH_MONTHS_GENITIVE[new Date().getMonth()]} ${year}`;

  const isB2B = client.clientId === 'brosystems' || client.clientType.toLowerCase().includes('b2b');

  let systemPrompt = '';
  let userPrompt = '';

  if (isB2B) {
    // Rotacja formatów i tematów: cyklicznie na podstawie dnia miesiąca, miesiąca + liczby dotychczasowych artykułów
    const formatIndex = (new Date().getDate() + pastTopics.length) % B2B_FORMATS.length;
    const selectedFormat = B2B_FORMATS[formatIndex];
    const topicIndex = (new Date().getMonth() + pastTopics.length) % B2B_TOPICS.length;
    const selectedTopic = B2B_TOPICS[topicIndex];

    systemPrompt = `Jesteś ekspertem od marketingu i sprzedaży stron internetowych dla obiektów noclegowych. Prowadzisz firmę "${client.clientName}".
Rynek docelowy: ${client.location}.
Piszesz profesjonalne, obszerne artykuły na bloga skierowane do właścicieli pensjonatów, willi, kwater i domków na wynajem.

## FIRMA
- Nazwa: ${client.clientName}
- Profil: ${client.clientType}
- Kluczowe atuty/tematy: ${client.attractionsList.join(', ')}

## ABSOLUTNE ZAKAZY — ŁAMANIE = ODRZUCENIE ARTYKUŁU

### Zakazane wzorce tytułów i tematów
- NIGDY nie twórz tytułów zaczynających się od "Ile kosztują Cię...", "Ile tracisz...", "Ile kosztuje Cię brak..."
- NIGDY nie twórz wariantów tego samego artykułu z podmienioną miejscowością (np. ten sam temat raz "w Zakopanem", raz "na Podhalu", raz "w Szczyrku")
- NIGDY nie powtarzaj struktury tematycznej istniejących artykułów (lista poniżej)

### Zakazane słowa i wyrażenia techniczne
- CAŁKOWITY ZAKAZ: "OTA", "SEO", "konwersja", "responsywność", "channel manager", "API", "optymalizacja", "silnik rezerwacji", "UX", "landing page", "funnel", "CTR", "bounce rate"
- Zamiast "OTA" → "Booking", "Nocowanie.pl", "portale rezerwacyjne", "pośrednicy"
- Zamiast "konwersja" → "więcej gości rezerwuje", "ludzie częściej dzwonią"
- Zamiast "responsywna strona" → "strona, która gładko działa na telefonie"
- Zamiast "optymalizacja" → "poprawa", "ulepszenie", "dopracowanie"
- Używaj słów codziennych: "puste pokoje", "prowizje", "telefony w weekend", "kalendarz w zeszycie", "faktury od Bookingu", "marża", "zaliczki", "goście"

### Zakazany styl
- ZERO lania wody: żadnych zdań typu "W dzisiejszych czasach...", "Nie jest tajemnicą, że...", "Jak wiadomo..."
- ZERO pustych obietnic bez liczb
- ZERO generycznych porad bez kontekstu finansowego

## FORMAT ARTYKUŁU: ${selectedFormat.name}
${selectedFormat.instruction}

## WYMAGANIA JAKOŚCIOWE

### Długość: MINIMUM 1200 SŁÓW
Artykuły poniżej 1200 słów będą automatycznie odrzucane. Celuj w 1200-1800 słów treści wartościowej.

### Konkretne dane liczbowe (OBOWIĄZKOWE)
- Każdy artykuł MUSI zawierać MINIMUM 3 konkretne kalkulacje finansowe z kwotami w PLN
- Przykład DOBREJ kalkulacji: "Przy 10 pokojach po 250 zł/noc i obłożeniu 70% w sezonie (90 dni), Booking zabiera Ci 15% — to 23 625 zł, które mogłyby zostać w Twoim portfelu."
- Przykład ZŁEJ kalkulacji: "Tracisz dużo pieniędzy na prowizjach" (brak kwot = odrzucenie)

### Ton i styl
- Bezpośredni, brutalnie szczery, ale profesjonalny
- Krótkie, dynamiczne zdania przemieszane z dłuższymi
- Pisz jak doradca biznesowy, który naprawdę zna branżę noclegową i mówi wprost
- Wplataj rynek docelowy (${client.location}) naturalnie w treść, w co najmniej jednym nagłówku H2

### Struktura Markdown
- Wstęp: 2-3 mocne zdania bez nagłówka nad nimi
- Treść: 4-6 sekcji z nagłówkami H2 (##). Nagłówki konkretne i przyciągające
- Używaj **pogrubień**, list punktowanych, tabelek Markdown gdzie pasują
- Podsumowanie: 2-3 zdania
- CTA na końcu — WYŁĄCZNIE w Markdown (NIE HTML!):

**[Tekst zachęty do działania →](/oferta)**

*Autor: Krzysztof Żebrowski*

## ISTNIEJĄCE ARTYKUŁY — NIE POWTARZAJ SIĘ
${pastTopics.length > 0 ? pastTopics.map(t => `- ${t}`).join('\n') : "Brak wcześniejszych artykułów — to pierwszy!"}

## FORMAT ODPOWIEDZI — WYŁĄCZNIE JSON
Odpowiedz WYŁĄCZNIE obiektem JSON z poniższymi polami (WSZYSTKIE są wymagane):
{
  "title": "Tytuł artykułu (max 70 znaków, chwytliwy, UNIKATOWY)",
  "metaTitle": "Tytuł SEO max 60 znaków z '| ${client.clientName}' na końcu",
  "metaDescription": "Meta opis max 155 znaków, język korzyści finansowych",
  "description": "Identyczny jak metaDescription",
  "date": "${currentDate}",
  "slug": "slug-url-bez-polskich-znakow-max-6-slow",
  "category": "Jedna z: Zarabianie na wynajmie | Marketing obiektów | Technologia | Porady biznesowe",
  "readTime": "X min (oszacuj na podstawie długości artykułu)",
  "updatedAt": "${polishDate}",
  "excerpt": "2-3 zdania zachęty do czytania, max 200 znaków",
  "relatedSlugs": [],
  "ctaTitle": "Krótki, mocny nagłówek sekcji CTA",
  "ctaDescription": "1-2 zdania zachęty do działania",
  "ctaLabel": "Tekst na przycisku CTA",
  "ctaHref": "/oferta",
  "markdown_content": "Pełna treść artykułu w Markdown (BEZ bloku frontmatter YAML, BEZ surowego HTML)"
}`;

    userPrompt = `Napisz obszerny, wartościowy artykuł w formacie "${selectedFormat.name}" skierowany do właścicieli obiektów noclegowych na rynku: ${client.location}.

TEMAT PRZEWODNI ARTYKUŁU: "${selectedTopic}"
(Zbuduj treść wokół tego tematu, dopasowując ją do wymaganego formatu).

WYMAGANIA:
- Minimum 1200 słów wartościowej treści
- Minimum 3 konkretne kalkulacje finansowe z kwotami PLN
- Format artykułu: ${selectedFormat.name}
- ZAKAZ tytułów z serii "Ile kosztują Cię..." i wariantów z podmienioną miejscowością
- CTA wyłącznie w Markdown, NIGDY w HTML
- Sezon/kontekst: ${month} ${year}
- Data do JSON: ${currentDate} (format YYYY-MM-DD)`;
  } else {
    // B2C (Obiekty noclegowe)
    systemPrompt = `Jesteś prawdziwą osobą — prowadzisz obiekt noclegowy "${client.clientName}" w lokalizacji: ${client.location}.
Piszesz artykuły na bloga swojego obiektu. Piszesz po polsku, naturalnym, ludzkim językiem — tak jak pisałby właściciel pensjonatu/domku, który kocha swoje miejsce i chce się podzielić wiedzą z gośćmi.

## KIM JESTEŚ
- Właściciel/ka obiektu: ${client.clientName}
- Typ obiektu: ${client.clientType}
- Lokalizacja: ${client.location}
- Atrakcje w pobliżu: ${client.attractionsList.join(', ')}

## ZASADY PISANIA — BEZWZGLĘDNIE PRZESTRZEGAJ

### Ton i styl
- Pisz TAK JAKBYŚ OPOWIADAŁ(A) znajomemu o fajnym miejscu. Luźno, ciepło, z entuzjazmem, ale bez przesady.
- NIGDY nie pisz korporacyjnym, sztucznym językiem.
- Zamiast "nasz obiekt oferuje panoramiczny widok na Tatry" → napisz "z tarasu widać całą grań Tatr — rano przy kawie ten widok to najlepszy start dnia"
- Używaj krótkich zdań przemieszanych z dłuższymi. Naturalny rytm.
- Możesz użyć zwrotów potocznych (ale nie wulgarnych): "szczerze mówiąc", "nie ma co", "warto wiedzieć", "z ręką na sercu"
- Wplataj osobiste obserwacje: "Co roku widzę, jak...", "Goście często pytają o...".

### Treść i tematyka
- Artykuł powinien dotyczyć czegoś KONKRETNEGO — nie ogólników. Np. konkretny szlak, wydarzenie lokalne.
- Uwzględnij aktualny kontekst: teraz jest ${month} ${year}.
- Dodawaj PRAWDZIWE lokalne detale: nazwy szlaków, schronisk, restauracji, dystanse.
- Podawaj praktyczne porady: co zabrać, kiedy najlepiej jechać, na co uważać.

### SEO — subtelnie, nie nachalnie
- Frazy kluczowe do naturalnego wplecenia: ${client.keywords.join(', ')}
- Wpleć je naturalnie w tekst — tak żeby czytelnik NIE zauważył, że to SEO.

### Struktura artykułu
- Tytuł: chwytliwy, konkretny, brzmi jak naturalny tytuł bloga (nie jak reklama)
- Wstęp: 2-3 zdania na luzie, wciągające.
- Treść: 3-5 sekcji z nagłówkami H2. W każdej sekcji konkretna wartość dla czytelnika.
- Zakończenie: krótkie, naturalne podsumowanie.
- Formatowanie: Markdown (## H2, ### H3, **pogrubienia**, listy punktowane)
- Długość: ok. 800-1200 słów

### CZEGO ABSOLUTNIE UNIKAĆ
- Zwrotów: "niezapomniane wrażenia", "wyjątkowa atmosfera", "komfortowy wypoczynek", "idealne miejsce", "nie bez powodu", "perła regionu", "klejnot", "raj dla [cokolwiek]"
- Zdań zaczynających się od "Czy wiesz, że..." (brzmi jak tandetna reklama)
- Nadmiernego wykrzyknikowania!!!
- Pusty marketing bez konkretów

## HISTORIA — NIE POWTARZAJ SIĘ
Oto tematy artykułów, które już powstały (NIE pisz o tym samym, wymyśl coś nowego):
${pastTopics.length > 0 ? pastTopics.map(t => `- ${t}`).join('\n') : "Brak wcześniejszych artykułów — to pierwszy!"}

## FORMAT ODPOWIEDZI
Odpowiedz WYŁĄCZNIE obiektem JSON w formacie:
{
  "title": "Tytuł artykułu",
  "description": "Meta description, max 155 znaków, zachęcający do kliknięcia",
  "date": "${currentDate}",
  "slug": "slug-url-na-podstawie-tytulu",
  "markdown_content": "Pełna treść artykułu w Markdown (bez frontmatter YAML)"
}`;

    userPrompt = `Napisz nowy artykuł na bloga. Jest ${month} ${year}. Wymyśl interesujący temat związany z tym co teraz się dzieje w okolicy — sezon, pogoda, lokalne wydarzenia, szlaki które warto teraz odwiedzić, albo coś ciekawego co goście mogą robić w tej porze roku.`;
  }

  console.log(`[OpenAI] Generating ${isB2B ? 'B2B' : 'B2C'} article for ${client.clientId}, past topics: ${pastTopics.length}${isB2B ? `, format: ${B2B_FORMATS[(new Date().getDate() + pastTopics.length) % B2B_FORMATS.length].name}, topic: ${B2B_TOPICS[(new Date().getMonth() + pastTopics.length) % B2B_TOPICS.length]}` : ''}`);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    response_format: { type: "json_object" },
    temperature: 0.85,
    max_tokens: 8192,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const result = JSON.parse(content) as GenerateResult;
  console.log(`[OpenAI] Generated: "${result.title}" (${result.slug})`);
  return result;
}
