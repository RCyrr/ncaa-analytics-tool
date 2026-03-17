#!/usr/bin/env python3
import os
import csv
import re
from bs4 import BeautifulSoup

def safe_float(x):
    if x is None or x == '':
        return None
    try:
        # Remove commas, percent signs, and plus signs
        clean_x = x.replace('%', '').replace(',', '').replace('+', '')
        return float(clean_x)
    except Exception:
        # Try to extract number with regex
        m = re.search(r"[-+]?[0-9]*\.?[0-9]+", x)
        if m:
            return float(m.group(0))
        return None

def clean_team_name(name):
    if not name:
        return ""
    # Remove NCAA tournament seeds like "Michigan (1)" or "Michigan 1"
    # Also remove trailing whitespace
    name = re.sub(r'\s*\(\d+\)$', '', name)
    name = re.sub(r'\s+\d+$', '', name)
    return name.strip()

def parse_html_excel(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    
    table = soup.find('table')
    if not table:
        return []

    # Extract headers from the second row of thead (the one with actual stat names)
    headers = []
    thead = table.find('thead')
    if thead:
        rows = thead.find_all('tr')
        if len(rows) >= 2:
            header_cells = rows[1].find_all(['th', 'td'])
        else:
            header_cells = rows[0].find_all(['th', 'td'])
        
        # Use data-stat attribute if available, otherwise use text
        for cell in header_cells:
            stat = cell.get('data-stat')
            if stat:
                headers.append(stat)
            else:
                headers.append(cell.get_text(strip=True).lower())
    
    results = []
    tbody = table.find('tbody')
    if not tbody:
        tbody = table # Fallback if no tbody

    for tr in tbody.find_all('tr'):
        # Skip header rows that might be repeated in tbody
        if tr.get('class') and ('thead' in tr.get('class') or 'over_header' in tr.get('class')):
            continue
        
        cells = tr.find_all(['th', 'td'])
        if not cells:
            continue
        
        row_data = {}
        for i, cell in enumerate(cells):
            if i < len(headers):
                stat_name = headers[i]
                row_data[stat_name] = cell.get_text(strip=True)
        
        # Extract necessary fields
        team = clean_team_name(row_data.get('school') or row_data.get('team'))
        if not team or team.lower() == 'school': # Skip header-like rows
            continue
            
        # Use SRS as the Net Rating as requested
        net_rating = row_data.get('srs') or row_data.get('net_rtg') or row_data.get('net_rating') or row_data.get('nrtg')
        pace = row_data.get('pace')
        ast = row_data.get('ast')
        tov = row_data.get('tov')
        efg_pct = row_data.get('efg_pct')
        ortg = row_data.get('ortg')
        drtg = row_data.get('drtg')
        
        # Calculate ATO
        ato_val = ""
        af = safe_float(ast)
        tf = safe_float(tov)
        if af is not None and tf is not None and tf != 0:
            ato_val = f"{af / tf:.3f}"
        
        results.append({
            'team': team,
            'net_rating': net_rating if net_rating is not None else "",
            'pace': pace if pace is not None else "",
            'ato': ato_val,
            'efg_pct': efg_pct if efg_pct is not None else "",
            'ortg': ortg if ortg is not None else "",
            'drtg': drtg if drtg is not None else "",
            'logo': ""
        })
        
    return results

def main():
    data_dir = 'data'
    output_file = os.path.join(data_dir, 'teams_2026.csv')
    bracket_file = os.path.join(data_dir, 'bracket_2026.csv')
    
    # Load bracket data
    bracket_data = {}
    if os.path.exists(bracket_file):
        with open(bracket_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                bracket_data[row['team']] = {
                    'seed': row['seed'],
                    'region': row['region']
                }

    all_teams = []
    seen_teams = set()

    for filename in os.listdir(data_dir):
        if filename.endswith('.xls'):
            file_path = os.path.join(data_dir, filename)
            print(f"Processing {filename}...")
            try:
                teams = parse_html_excel(file_path)
                for team_data in teams:
                    if team_data['team'] not in seen_teams:
                        # Merge bracket info
                        b_info = bracket_data.get(team_data['team'])
                        if b_info:
                            team_data['seed'] = b_info['seed']
                            team_data['region'] = b_info['region']
                            team_data['is_qualified'] = '1'
                        else:
                            team_data['seed'] = ''
                            team_data['region'] = ''
                            team_data['is_qualified'] = '0'
                            
                        all_teams.append(team_data)
                        seen_teams.add(team_data['team'])
            except Exception as e:
                print(f"Error processing {filename}: {e}")

    # Sort teams by name
    all_teams.sort(key=lambda x: x['team'])

    # Write to CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['team', 'net_rating', 'pace', 'ato', 'efg_pct', 'ortg', 'drtg', 'seed', 'region', 'is_qualified', 'logo']
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_teams)
    
    print(f"Successfully wrote {len(all_teams)} teams to {output_file}")

if __name__ == "__main__":
    main()
