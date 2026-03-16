# NCAA Analytics Dashboard

A modern, interactive dashboard for comparing NCAA basketball teams using 4-axis performance profiles.

## Features

- **4-Axis Visualization**: Compare teams across multiple metrics (Net Rating, Pace, ORtg, DRtg, eFG%, ATO).
- **Multiple Display Modes**:
  - **Default**: Overall team profile.
  - **Efficiency**: Focus on scoring and ball security (with inverted DRtg).
  - **Performance**: Focus on scoring and tempo.
- **Tournament Filtering**: Quickly filter for the 68 teams in the March Madness bracket.
- **Real-time Search**: Find any of the 365 NCAA teams instantly.
- **Team Detail Cards**: View exact statistics for all selected teams.

## Getting Started

### Prerequisites

- A local web server (e.g., VS Code **Live Server** extension).
- Python 3.x (only if you want to re-process the data).

### Installation

1. Clone the repository to your local machine.
2. Open the project folder in VS Code.
3. Start **Live Server** by clicking "Go Live" in the status bar or right-clicking `index.html`.

## Data Processing

The dashboard comes with pre-processed data in `data/teams_2026.csv`. If you add new conference data files (`.xls` format) to the `data/` directory, you can refresh the dataset by running:

```bash
python scripts/process_excel_data.py
```

This script will:
1. Parse all HTML-based Excel files in the `data/` directory.
2. Merge seeding information from `data/bracket_2026.csv`.
3. Calculate derived metrics like ATO ratio.
4. Generate the consolidated `data/teams_2026.csv` used by the dashboard.

## Technologies Used

- **D3.js**: For the 4-axis radial visualization and data loading.
- **HTML5/CSS3**: Modern dashboard layout with CSS Grid and Flexbox.
- **Python**: Data extraction and processing scripts.
- **BeautifulSoup4**: For parsing HTML-based Excel files.
