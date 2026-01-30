# BDL MCP Server

Serwer MCP (Model Context Protocol) dla API BDL (Bank Danych Lokalnych) - publicznego API GUS (Główny Urząd Statystyczny) udostępniającego dane statystyczne o Polsce.

## Opis

Ten serwer MCP umożliwia dostęp do danych statystycznych GUS poprzez protokół MCP. Dzięki temu modele językowe (LLM) mogą bezpośrednio pobierać i analizować dane statystyczne o Polsce.

## Funkcjonalności

Serwer udostępnia następujące narzędzia (tools):

### Poziomy agregacji (Aggregates)
- `get_aggregates` - Lista poziomów agregacji (kraj, województwo, powiat, gmina)
- `get_aggregate_by_id` - Szczegóły poziomu agregacji

### Atrybuty (Attributes)
- `get_attributes` - Lista atrybutów danych
- `get_attribute_by_id` - Szczegóły atrybutu

### Dane statystyczne (Data)
- `get_data_by_variable` - Dane dla jednej zmiennej
- `get_data_by_unit` - Dane dla jednostki terytorialnej
- `get_data_localities_by_unit` - Dane dla miejscowości

### Poziomy jednostek (Levels)
- `get_levels` - Lista poziomów jednostek terytorialnych
- `get_level_by_id` - Szczegóły poziomu

### Jednostki miary (Measures)
- `get_measures` - Lista jednostek miary
- `get_measure_by_id` - Szczegóły jednostki miary

### Tematy (Subjects)
- `get_subjects` - Lista tematów (kategorii danych)
- `get_subject_by_id` - Szczegóły tematu

### Jednostki terytorialne (Units)
- `get_units` - Lista jednostek terytorialnych
- `get_unit_by_id` - Szczegóły jednostki
- `search_units` - Wyszukiwanie jednostek po nazwie
- `get_localities` - Lista miejscowości statystycznych

### Zmienne (Variables)
- `get_variables` - Lista zmiennych (cech statystycznych)
- `get_variable_by_id` - Szczegóły zmiennej
- `search_variables` - Wyszukiwanie zmiennych

### Lata (Years)
- `get_years` - Lista lat z dostępnymi danymi
- `get_year_by_id` - Szczegóły roku

## Instalacja

### Wymagania
- Python 3.10+

### Instalacja zależności

```bash
pip install -r requirements.txt
```

Lub z wykorzystaniem pip:

```bash
pip install mcp httpx
```

## Uruchomienie

### Bezpośrednie uruchomienie

```bash
python server.py
```

### Konfiguracja w Claude Desktop

Dodaj do pliku konfiguracyjnego Claude Desktop (`claude_desktop_config.json`):

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bdl-api": {
      "command": "python",
      "args": ["/ścieżka/do/mcp-server/server.py"]
    }
  }
}
```

Lub z wykorzystaniem `uv`:

```json
{
  "mcpServers": {
    "bdl-api": {
      "command": "uv",
      "args": [
        "--directory",
        "/ścieżka/do/mcp-server",
        "run",
        "server.py"
      ]
    }
  }
}
```

## Przykłady użycia

### Pobranie listy województw

```
Użyj narzędzia get_units z parametrami:
- level: 2
- page_size: 20
```

### Wyszukanie danych o ludności Warszawy

```
1. Użyj search_units z name: "Warszawa"
2. Użyj search_variables z name: "ludność"
3. Użyj get_data_by_unit z odpowiednimi ID
```

### Pobranie danych demograficznych dla całego kraju

```
1. Użyj get_subjects aby znaleźć temat "Ludność"
2. Użyj get_variables z subject_id tematu
3. Użyj get_data_by_variable z var_id i unit_id: "000000000000" (Polska)
```

## Struktura odpowiedzi API

Odpowiedzi z API BDL zawierają typowo:
- `results` - lista wyników
- `totalRecords` - całkowita liczba rekordów
- `page` - numer strony
- `pageSize` - rozmiar strony
- `links` - linki do nawigacji (poprzednia/następna strona)

## Języki

API obsługuje dwa języki:
- `pl` - polski (domyślny)
- `en` - angielski

Parametr `lang` można przekazać do każdego narzędzia.

## Limity API

API BDL ma limity zapytań (rate limiting). Informacje o limitach są zwracane w nagłówkach odpowiedzi:
- `X-Rate-Limit-Limit` - limit zapytań
- `X-Rate-Limit-Remaining` - pozostałe zapytania
- `X-Rate-Limit-Reset` - czas resetu limitu

## Dokumentacja API BDL

Pełna dokumentacja API BDL dostępna jest pod adresem:
https://api.stat.gov.pl/Home/BdlApi

## Licencja

GNU GENERAL PUBLIC LICENSE

Stworzono na podstawie specyfikacji OpenAPI BDL API.
