#!/usr/bin/env python3
"""
Scrape team-level statistics from Sports-Reference season page and write CSV suitable
for the March Madness Visualizer.

Usage:
  python scripts/scrape_sportsref.py https://www.sports-reference.com/cbb/seasons/men/2026.html

Notes:
- The script attempts to locate a table containing 'School' (team) and common columns
  like 'AdjEM' (adjusted net rating) and 'Pace'. It will write all found teams to
  data/teams_2026.csv. Some derived metrics (ATO, paint_pct) are computed when
  source columns exist; otherwise left blank.
"""
import sys
import os
import csv
import re
from typing import List, Dict

try:
    import requests
    from bs4 import BeautifulSoup
except Exception as e:
    print("Missing dependencies. Please install requirements: pip install requests beautifulsoup4")
    raise


def text_or_none(cell):
    if cell is None:
        return None
    return cell.get_text(strip=True)


def parse_table(table) -> List[Dict[str, str]]:
    # Extract headers
    headers = []
    thead = table.find('thead')
    if thead:
        header_cells = thead.find_all('th')
        headers = [h.get_text(strip=True) for h in header_cells]
    else:
        first_row = table.find('tr')
        if first_row:
            headers = [th.get_text(strip=True) for th in first_row.find_all('th')]

    # Normalize headers
    headers = [h.replace('\xa0', ' ').strip() for h in headers if h]
    if not headers:
        return []

    # Extract rows
    rows = []
    tbody = table.find('tbody') or table
    for tr in tbody.find_all('tr'):
        # skip separator rows
        if tr.get('class') and ('thead' in tr.get('class') or 'over_header' in tr.get('class')):
            continue
        cells = tr.find_all(['th', 'td'])
        if not cells:
            continue
        values = [c.get_text(strip=True) for c in cells]
        # Some tables include a leading rank cell; align by taking first len(headers) values
        if len(values) < len(headers):
            # pad
            values += [''] * (len(headers) - len(values))
        row = dict(zip(headers, values))
        rows.append(row)

    return rows


def find_best_table(soup):
    tables = soup.find_all('table')
    candidates = []
    for table in tables:
        rows = parse_table(table)
        if not rows:
            continue
        headers = list(rows[0].keys())
        header_str = ' '.join(headers).lower()
        score = 0
        if 'school' in header_str or 'team' in header_str:
            score += 5
        if 'adjem' in header_str or 'adj. em' in header_str or 'adj em' in header_str or 'net' in header_str:
            score += 3
        if 'pace' in header_str or 'tempo' in header_str:
            score += 2
        if score > 0:
            candidates.append((score, table))
    if not candidates:
        return None
    candidates.sort(key=lambda x: -x[0])
    return candidates[0][1]


def safe_float(x):
    if x is None or x == '':
        return None
    # remove commas and percent signs
    try:
        return float(x.replace('%', '').replace(',', ''))
    except Exception:
        # try to extract number with regex
        m = re.search(r"[-+]?[0-9]*\.?[0-9]+", x)
        if m:
            return float(m.group(0))
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/scrape_sportsref.py <season_url>")
        sys.exit(1)
    url = sys.argv[1]
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
    }
    # polite retry
    resp = None
    for attempt in range(3):
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            break
        else:
            print(f"Attempt {attempt+1} returned {resp.status_code}, retrying...")
    if resp is None:
        print("Failed to fetch page after retries")
        sys.exit(2)
    if resp.status_code != 200:
        print(f"Failed to fetch page: status {resp.status_code}")
        sys.exit(2)
    soup = BeautifulSoup(resp.text, 'html.parser')

    table = find_best_table(soup)
    if table is None:
        print("Could not find a suitable table on the page.")
        sys.exit(2)

    rows = parse_table(table)
    output_rows = []
    for r in rows:
        # Find team name key
        team = None
        for k in r.keys():
            if k.lower() in ('school', 'team', 'team name') or 'school' in k.lower():
                team = r.get(k)
                break
        if not team:
            continue

        # net rating keys
        net = None
        for key in r.keys():
            lk = key.lower()
            if 'adjem' in lk or 'adj. em' in lk or 'adj em' in lk or 'adj em' in lk or 'net' == lk or 'net rating' in lk:
                net = r.get(key)
                break
        # pace
        pace = None
        for key in r.keys():
            lk = key.lower()
            if 'pace' in lk or 'tempo' in lk:
                pace = r.get(key)
                break

        # assists and turnovers for ATO
        ast = None
        tov = None
        for key in r.keys():
            lk = key.lower()
            if lk in ('ast', 'asts', 'a') or 'assist' in lk:
                ast = r.get(key)
            if lk in ('tov', 'tovs') or 'turnover' in lk:
                tov = r.get(key)

        ato = None
        af = safe_float(ast)
        tf = safe_float(tov)
        if af is not None and tf is not None and tf != 0:
            ato = af / tf

        # paint % - try common keys
        paint = None
        for key in r.keys():
            lk = key.lower()
            if 'paint' in lk or 'points in paint' in lk or 'in paint' in lk:
                paint = r.get(key)
                break

        output_rows.append({
            'team': team,
            'net_rating': '' if net is None else net,
            'pace': '' if pace is None else pace,
            'ato': '' if ato is None else f"{ato:.3f}",
            'paint_pct': '' if paint is None else paint,
            'logo': ''
        })

    out_path = os.path.join('data', 'teams_2026.csv')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['team', 'net_rating', 'pace', 'ato', 'paint_pct', 'logo'])
        writer.writeheader()
        for row in output_rows:
            writer.writerow(row)

    print(f"Wrote {len(output_rows)} teams to {out_path}")


if __name__ == '__main__':
    main()

