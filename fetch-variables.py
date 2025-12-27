import requests
import json

# Podstawowy adres URL zdefiniowany w swagger.json (serwer + endpoint)
BASE_URL = "https://bdl.stat.gov.pl/api/v1/variables"

# Parametry zapytania opisane w dokumentacji (swagger.json)
params = {
    'page-size': 100,  # Maksymalny rozmiar strony
    'lang': 'pl',      # Język odpowiedzi
    'format': 'json'   # Format danych
}

def pobierz_wszystkie_zmienne():
    wszystkie_zmienne = []
    page = 0
    
    try:
        while True:
            params['page'] = page
            print(f"Pobieranie strony {page}...")
            
            response = requests.get(BASE_URL, params=params)
            response.raise_for_status()
            
            data = response.json()
            results = data.get('results', [])
            
            if not results:
                break
            
            wszystkie_zmienne.extend(results)
            
            total_records = data.get('totalRecords', 0)
            print(f"Pobrano {len(wszystkie_zmienne)} z {total_records} zmiennych")
            
            # Sprawdź czy są jeszcze strony
            if len(wszystkie_zmienne) >= total_records:
                break
            
            page += 1
        
        print(f"\n✅ Pobrano łącznie {len(wszystkie_zmienne)} zmiennych")
        
        # Zapisz do pliku JSON
        with open('gus-variables.json', 'w', encoding='utf-8') as f:
            json.dump(wszystkie_zmienne, f, ensure_ascii=False, indent=2)
        print("📄 Zapisano do pliku: gus-variables.json")
        
        # Stwórz słownik zmiennych indeksowany po ID
        zmienne_dict = {str(var['id']): var for var in wszystkie_zmienne}
        
        # Zapisz słownik do pliku JSON
        with open('gus-variables-dict.json', 'w', encoding='utf-8') as f:
            json.dump(zmienne_dict, f, ensure_ascii=False, indent=2)
        print("📄 Zapisano do pliku: gus-variables-dict.json")
        
        # Zapisz do pliku tekstowego (czytelny format)
        with open('gus-variables.txt', 'w', encoding='utf-8') as f:
            f.write(f"Lista zmiennych GUS BDL (łącznie: {len(wszystkie_zmienne)})\n")
            f.write("=" * 80 + "\n\n")
            
            for var in wszystkie_zmienne:
                # Łączenie wymiarów n1-n5 zdefiniowanych w schemacie Variable
                pelna_nazwa = " - ".join(filter(None, [
                    var.get('n1'), var.get('n2'), var.get('n3'), var.get('n4'), var.get('n5')
                ]))
                
                f.write(f"ID: {var.get('id')}\n")
                f.write(f"Nazwa: {pelna_nazwa}\n")
                f.write(f"Jednostka miary: {var.get('measureUnitName')}\n")
                f.write(f"Temat: {var.get('subjectId')}\n")
                f.write("-" * 80 + "\n")
        
        print("📄 Zapisano do pliku: gus-variables.txt")
        
        # Wyświetl przykładowe zmienne
        print("\n📊 Przykładowe zmienne:")
        print("-" * 80)
        for var in wszystkie_zmienne[:5]:
            pelna_nazwa = " - ".join(filter(None, [
                var.get('n1'), var.get('n2'), var.get('n3'), var.get('n4'), var.get('n5')
            ]))
            print(f"ID: {var.get('id')} | {pelna_nazwa}")
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Wystąpił błąd podczas połączenia: {e}")
    except Exception as e:
        print(f"❌ Wystąpił błąd: {e}")

if __name__ == "__main__":
    pobierz_wszystkie_zmienne()
