# AI Content Engine Turbo

Scentralizowany mikroserwis Node.js (TypeScript) do automatycznego generowania i publikowania zoptymalizowanych artykułów SEO na blogi klientów. Działa 24/7 w oparciu o harmonogram zadań (cron).

## Funkcjonalności

- **Automatyzacja Cron:** Samodzielne generowanie treści w zdefiniowanych odstępach czasu.
- **AI & Web Search:** Wykorzystuje model `gpt-4o` (OpenAI), który posiada szeroką wiedzę o trendach i sezonowości, dostarczając spersonalizowane treści.
- **GitOps (GitHub API):** Bezpośrednia publikacja artykułów na GitHubie (jako pliki `.md` z poprawnym Frontmatter).
- **Zarządzanie Historią:** Zapobiega duplikowaniu tytułów – pamięta ostatnio poruszane tematy.

## Struktura Katalogów
- `config/clients.json` - konfiguracja każdego klienta (wymaga zmapowania wolumenu).
- `data/history.json` - plik bazodanowy historii tematów (wymaga zmapowania wolumenu dla persystencji).

## Wdrożenie w Coolify (Docker)

Ten mikroserwis jest w pełni zoptymalizowany pod kątem wdrożenia w [Coolify](https://coolify.io/).

### 1. Wymagane zmienne środowiskowe (Environment Variables)

W panelu Coolify przejdź do swojego serwisu i dodaj następujące zmienne:

- `OPENAI_API_KEY` - klucz API z OpenAI.
- `GITHUB_TOKEN` - Twój uniwersalny klucz do GitHuba (Personal Access Token), który ma uprawnienia do edytowania repozytoriów wszystkich klientów.

### 2. Mapowanie Wolumenów (Storage)

W Coolify skonfiguruj "Persistent Storage" (Storage w zakładce serwisów):
- Mapowanie do `/app/config` - aby przetrzymywać konfigurację `clients.json`.
- Mapowanie do `/app/data` - aby zapisywać i nie tracić historii `history.json` podczas restartów kontenera.

### 3. Konfiguracja Klientów

Przykładowy plik `config/clients.json`:

```json
[
  {
    "clientId": "domki-koscielisko",
    "clientName": "Domki pod Giewontem",
    "clientType": "całoroczne domki z sauną",
    "location": "Kościelisko, Podhale",
    "attractionsList": ["Dolina Kościeliska (800m)", "Termy Chocholowskie (8km)", "Witów-Ski (5km)"],
    "keywords": ["domki kościelisko", "noclegi z sauną podhale", "gdzie na majówkę w góry"],
    "githubRepo": "twoj-username/domki-koscielisko-web",
    "destinationFolder": "src/content/blog",
    "cronSchedule": "0 9 * * 1"
  }
]
```

## Lokalne Uruchomienie

1. Sklonuj repozytorium.
2. Skopiuj plik `.env.example` (jeśli istnieje) lub stwórz plik `.env` i uzupełnij klucze.
3. Wykonaj komendę:
```bash
npm install
npm run dev
```

Podczas pracy w trybie produkcyjnym użyj:
```bash
npm run build
npm start
```
