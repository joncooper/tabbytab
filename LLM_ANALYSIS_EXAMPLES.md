# LLM Analysis Examples for TabbyTab Data

This guide provides Python scripts and examples for analyzing your tab browsing history using LLMs, embeddings, and data science techniques.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Example 1: Load and Explore Data](#example-1-load-and-explore-data)
- [Example 2: Topic Clustering with Embeddings](#example-2-topic-clustering-with-embeddings)
- [Example 3: Temporal Analysis](#example-3-temporal-analysis)
- [Example 4: Domain Interest Mapping](#example-4-domain-interest-mapping)
- [Example 5: Content Summarization with Claude](#example-5-content-summarization-with-claude)
- [Example 6: Research Trail Discovery](#example-6-research-trail-discovery)
- [Example 7: Automated Insights Report](#example-7-automated-insights-report)
- [Advanced: Build a Recommendation System](#advanced-build-a-recommendation-system)

---

## Prerequisites

### Install Dependencies

```bash
pip install pandas numpy scikit-learn openai anthropic matplotlib seaborn plotly
```

### Set Up API Keys

```bash
# Add to your ~/.bashrc or ~/.zshrc
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

Or create a `.env` file:
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Quick Start

### Export Your Data

1. Open TabbyTab → Settings
2. Scroll to **Export History for LLM Processing**
3. Click **JSONL (Recommended)**
4. Save to your working directory as `tabs.jsonl`

---

## Example 1: Load and Explore Data

### Basic Loading and Statistics

```python
import pandas as pd
import json
from datetime import datetime
from collections import Counter

# Load JSONL file
def load_tabs(filepath='tabs.jsonl'):
    """Load tab history from JSONL export."""
    tabs = []
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            tabs.append(json.loads(line))

    df = pd.DataFrame(tabs)
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    return df

# Load your data
df = load_tabs('tabs.jsonl')

# Basic statistics
print(f"Total tabs: {len(df)}")
print(f"Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
print(f"Unique domains: {df['domain'].nunique()}")
print(f"Closed tabs: {df['closed'].sum()}")
print(f"Active tabs: {(~df['closed']).sum()}")

# Top domains
print("\nTop 10 domains:")
print(df['domain'].value_counts().head(10))

# Activity by day of week
df['day_of_week'] = df['timestamp'].dt.day_name()
print("\nActivity by day:")
print(df['day_of_week'].value_counts())

# Activity by hour
df['hour'] = df['timestamp'].dt.hour
print("\nMost active hours:")
print(df['hour'].value_counts().sort_index())
```

**Output:**
```
Total tabs: 15,432
Date range: 2024-01-15 08:23:15 to 2025-11-16 14:30:22
Unique domains: 2,847
Closed tabs: 14,892
Active tabs: 540

Top 10 domains:
github.com          1,234
stackoverflow.com     892
docs.python.org       645
arxiv.org             521
...
```

---

## Example 2: Topic Clustering with Embeddings

### Using OpenAI Embeddings for Topic Discovery

```python
from openai import OpenAI
import numpy as np
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt

client = OpenAI()

def get_embeddings(texts, model="text-embedding-3-small"):
    """Get embeddings for a list of texts."""
    # Process in batches to avoid rate limits
    batch_size = 100
    embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        response = client.embeddings.create(
            model=model,
            input=batch
        )
        embeddings.extend([item.embedding for item in response.data])

    return np.array(embeddings)

# Prepare text for embedding (combine title and summary)
df['text'] = df['title'] + '. ' + df['summary'].fillna('')

# Sample for demonstration (or use all if you have credits)
sample_df = df.sample(min(1000, len(df)), random_state=42)

print("Getting embeddings from OpenAI...")
embeddings = get_embeddings(sample_df['text'].tolist())

# Cluster into topics
n_clusters = 20
kmeans = KMeans(n_clusters=n_clusters, random_state=42)
sample_df['cluster'] = kmeans.fit_predict(embeddings)

# Analyze each cluster
print("\n=== Topic Clusters ===\n")
for cluster_id in range(n_clusters):
    cluster_tabs = sample_df[sample_df['cluster'] == cluster_id]

    print(f"Cluster {cluster_id} ({len(cluster_tabs)} tabs)")

    # Top domains in cluster
    top_domains = cluster_tabs['domain'].value_counts().head(3)
    print(f"  Top domains: {', '.join(top_domains.index.tolist())}")

    # Sample titles
    print(f"  Sample titles:")
    for title in cluster_tabs['title'].head(3):
        print(f"    - {title[:80]}...")
    print()

# Visualize clusters with PCA
pca = PCA(n_components=2)
embeddings_2d = pca.fit_transform(embeddings)

plt.figure(figsize=(12, 8))
scatter = plt.scatter(
    embeddings_2d[:, 0],
    embeddings_2d[:, 1],
    c=sample_df['cluster'],
    cmap='tab20',
    alpha=0.6
)
plt.colorbar(scatter)
plt.title('Tab Topics Visualization')
plt.xlabel('PCA Component 1')
plt.ylabel('PCA Component 2')
plt.savefig('topic_clusters.png', dpi=300, bbox_inches='tight')
print("Saved visualization to topic_clusters.png")
```

---

## Example 3: Temporal Analysis

### Discover Your Browsing Patterns Over Time

```python
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Resample by day
daily_activity = df.resample('D', on='timestamp').size()

# Plot activity over time
fig, axes = plt.subplots(3, 1, figsize=(14, 10))

# Daily activity
axes[0].plot(daily_activity.index, daily_activity.values)
axes[0].set_title('Daily Browsing Activity')
axes[0].set_ylabel('Tabs Opened')
axes[0].grid(True, alpha=0.3)

# Weekly rolling average
weekly_avg = daily_activity.rolling(window=7).mean()
axes[1].plot(weekly_avg.index, weekly_avg.values, color='orange')
axes[1].set_title('Weekly Rolling Average')
axes[1].set_ylabel('Avg Tabs/Day')
axes[1].grid(True, alpha=0.3)

# Heatmap: hour vs day of week
df['day_name'] = df['timestamp'].dt.day_name()
df['hour'] = df['timestamp'].dt.hour

heatmap_data = df.groupby(['day_name', 'hour']).size().unstack(fill_value=0)
day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
heatmap_data = heatmap_data.reindex(day_order)

sns.heatmap(heatmap_data, cmap='YlOrRd', ax=axes[2], cbar_kws={'label': 'Tabs Opened'})
axes[2].set_title('Activity Heatmap: Hour of Day vs Day of Week')
axes[2].set_xlabel('Hour of Day')
axes[2].set_ylabel('')

plt.tight_layout()
plt.savefig('temporal_analysis.png', dpi=300, bbox_inches='tight')
print("Saved temporal analysis to temporal_analysis.png")
```

---

## Example 4: Domain Interest Mapping

### Categorize and Visualize Your Domain Interests

```python
import anthropic
from collections import defaultdict

client = anthropic.Anthropic()

# Get top 50 domains
top_domains = df['domain'].value_counts().head(50)

# Categorize domains using Claude
def categorize_domains(domains):
    """Use Claude to categorize domains into topics."""
    domain_list = '\n'.join([f"- {d}" for d in domains])

    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": f"""Categorize these domains into high-level topics (e.g., Programming, Research, News, Social Media, etc.).
Return as JSON mapping domain to category.

Domains:
{domain_list}

Return ONLY valid JSON like: {{"github.com": "Programming", "arxiv.org": "Research"}}"""
        }]
    )

    # Parse JSON response
    import json
    categories = json.loads(message.content[0].text)
    return categories

print("Categorizing domains with Claude...")
domain_categories = categorize_domains(top_domains.index.tolist())

# Map categories to tabs
df['category'] = df['domain'].map(domain_categories)

# Count by category
category_counts = df['category'].value_counts()

# Visualize
fig, axes = plt.subplots(1, 2, figsize=(16, 6))

# Pie chart
axes[0].pie(category_counts.values, labels=category_counts.index, autopct='%1.1f%%')
axes[0].set_title('Browsing by Category')

# Bar chart with top domains per category
category_domain_counts = df.groupby(['category', 'domain']).size()
top_per_category = category_domain_counts.groupby(level=0).nlargest(3)

# This is a simplified version; you can make it more detailed
axes[1].barh(range(len(category_counts)), category_counts.values)
axes[1].set_yticks(range(len(category_counts)))
axes[1].set_yticklabels(category_counts.index)
axes[1].set_xlabel('Number of Tabs')
axes[1].set_title('Tabs per Category')

plt.tight_layout()
plt.savefig('domain_interests.png', dpi=300, bbox_inches='tight')
print("Saved domain interests to domain_interests.png")

print("\nTop domains per category:")
for category in category_counts.index[:5]:
    print(f"\n{category}:")
    cat_df = df[df['category'] == category]
    for domain, count in cat_df['domain'].value_counts().head(3).items():
        print(f"  {domain}: {count} tabs")
```

---

## Example 5: Content Summarization with Claude

### Generate Weekly Browsing Summaries

```python
import anthropic
from datetime import datetime, timedelta

client = anthropic.Anthropic()

def generate_weekly_summary(df, week_start):
    """Generate a summary of browsing activity for a specific week."""
    week_end = week_start + timedelta(days=7)
    week_df = df[(df['timestamp'] >= week_start) & (df['timestamp'] < week_end)]

    if len(week_df) == 0:
        return "No activity this week."

    # Prepare data for Claude
    top_domains = week_df['domain'].value_counts().head(10)
    sample_titles = week_df['title'].head(20).tolist()

    domains_text = '\n'.join([f"- {d}: {c} visits" for d, c in top_domains.items()])
    titles_text = '\n'.join([f"- {t}" for t in sample_titles])

    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": f"""Analyze this week's browsing history and provide insights about the user's interests and activities.

Week: {week_start.strftime('%Y-%m-%d')} to {week_end.strftime('%Y-%m-%d')}
Total tabs: {len(week_df)}

Top domains visited:
{domains_text}

Sample page titles:
{titles_text}

Provide:
1. Main topics/themes (2-3 sentences)
2. Notable patterns or focus areas
3. Suggested related topics to explore"""
        }]
    )

    return message.content[0].text

# Generate summaries for the last 4 weeks
print("=== Weekly Browsing Summaries ===\n")
for i in range(4):
    week_start = datetime.now() - timedelta(weeks=i+1)
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    summary = generate_weekly_summary(df, week_start)

    print(f"Week of {week_start.strftime('%Y-%m-%d')}:")
    print(summary)
    print("\n" + "="*60 + "\n")
```

---

## Example 6: Research Trail Discovery

### Find Connected Topics in Your Browsing

```python
import networkx as nx
import matplotlib.pyplot as plt
from datetime import timedelta

def find_research_trails(df, time_window_minutes=60):
    """
    Find sequences of tabs opened within a time window,
    suggesting research trails or deep dives.
    """
    # Sort by timestamp
    df_sorted = df.sort_values('timestamp')

    # Find clusters of tabs within time window
    trails = []
    current_trail = []

    for idx, row in df_sorted.iterrows():
        if not current_trail:
            current_trail.append(row)
        else:
            time_diff = (row['timestamp'] - current_trail[-1]['timestamp']).total_seconds() / 60

            if time_diff <= time_window_minutes:
                current_trail.append(row)
            else:
                if len(current_trail) >= 5:  # At least 5 tabs
                    trails.append(current_trail)
                current_trail = [row]

    # Add last trail if long enough
    if len(current_trail) >= 5:
        trails.append(current_trail)

    return trails

# Find research trails
trails = find_research_trails(df)

print(f"Found {len(trails)} research trails (5+ tabs within 60 minutes)\n")

# Analyze top 5 longest trails
trails_sorted = sorted(trails, key=len, reverse=True)

for i, trail in enumerate(trails_sorted[:5]):
    print(f"\n=== Research Trail #{i+1} ===")
    print(f"Tabs: {len(trail)}")
    print(f"Duration: {(trail[-1]['timestamp'] - trail[0]['timestamp'])}")
    print(f"Start: {trail[0]['timestamp']}")

    # Domains in this trail
    domains = [t['domain'] for t in trail]
    domain_counts = Counter(domains)
    print(f"Domains: {', '.join([f'{d} ({c})' for d, c in domain_counts.most_common(5)])}")

    # Sample titles
    print("Sample pages:")
    for t in trail[:5]:
        print(f"  - {t['title'][:70]}...")

# Visualize a trail as a graph
def visualize_trail(trail, save_path='research_trail.png'):
    """Visualize a research trail as a network graph."""
    G = nx.DiGraph()

    for i, tab in enumerate(trail):
        # Add node with shortened title
        short_title = tab['title'][:30] + '...' if len(tab['title']) > 30 else tab['title']
        G.add_node(i, title=short_title, domain=tab['domain'])

        # Add edge from previous tab
        if i > 0:
            G.add_edge(i-1, i)

    plt.figure(figsize=(14, 10))
    pos = nx.spring_layout(G, k=2, iterations=50)

    # Color nodes by domain
    domains = [data['domain'] for _, data in G.nodes(data=True)]
    unique_domains = list(set(domains))
    colors = [unique_domains.index(d) for d in domains]

    nx.draw_networkx_nodes(G, pos, node_color=colors, node_size=500, cmap='tab10')
    nx.draw_networkx_edges(G, pos, edge_color='gray', arrows=True, arrowsize=20)

    # Labels
    labels = {i: data['title'] for i, data in G.nodes(data=True)}
    nx.draw_networkx_labels(G, pos, labels, font_size=8)

    plt.title(f'Research Trail: {len(trail)} tabs')
    plt.axis('off')
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    print(f"\nSaved trail visualization to {save_path}")

if trails_sorted:
    visualize_trail(trails_sorted[0])
```

---

## Example 7: Automated Insights Report

### Generate a Comprehensive Markdown Report

```python
def generate_insights_report(df, output_file='browsing_insights.md'):
    """Generate a comprehensive markdown report of browsing insights."""

    report = f"""# Browsing Insights Report
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Overview
- **Total Tabs**: {len(df):,}
- **Date Range**: {df['timestamp'].min()} to {df['timestamp'].max()}
- **Days of Data**: {(df['timestamp'].max() - df['timestamp'].min()).days}
- **Unique Domains**: {df['domain'].nunique():,}
- **Average Tabs/Day**: {len(df) / max((df['timestamp'].max() - df['timestamp'].min()).days, 1):.1f}

## Top Domains
| Domain | Visits | Percentage |
|--------|--------|------------|
"""

    top_domains = df['domain'].value_counts().head(20)
    total_tabs = len(df)

    for domain, count in top_domains.items():
        pct = (count / total_tabs) * 100
        report += f"| {domain} | {count:,} | {pct:.1f}% |\n"

    report += """
## Temporal Patterns

### Most Active Days
| Day | Tabs Opened |
|-----|-------------|
"""

    day_counts = df['day_of_week'].value_counts()
    for day, count in day_counts.items():
        report += f"| {day} | {count:,} |\n"

    report += """
### Most Active Hours
| Hour | Tabs Opened |
|------|-------------|
"""

    hour_counts = df['hour'].value_counts().sort_index()
    for hour, count in hour_counts.items():
        report += f"| {hour:02d}:00 | {count:,} |\n"

    report += """
## Insights

"""

    # Generate insights with Claude
    try:
        client = anthropic.Anthropic()

        stats = f"""
Total tabs: {len(df):,}
Top 10 domains: {', '.join(top_domains.head(10).index.tolist())}
Most active day: {day_counts.idxmax()}
Most active hour: {hour_counts.idxmax()}:00
"""

        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""Based on this browsing data, provide 5-7 insights about the user's habits, interests, and patterns:

{stats}

Format as markdown bullet points."""
            }]
        )

        report += message.content[0].text
    except Exception as e:
        report += f"- Could not generate AI insights: {e}\n"

    # Save report
    with open(output_file, 'w') as f:
        f.write(report)

    print(f"Saved insights report to {output_file}")
    return report

# Generate report
report = generate_insights_report(df)
print(report)
```

---

## Advanced: Build a Recommendation System

### Suggest Content Based on Browsing History

```python
from sklearn.metrics.pairwise import cosine_similarity

class TabRecommender:
    """Recommend tabs/topics based on browsing history."""

    def __init__(self, df, embeddings):
        self.df = df
        self.embeddings = embeddings

    def recommend_similar_tabs(self, tab_index, n=5):
        """Find similar tabs based on embedding similarity."""
        # Calculate cosine similarity
        similarities = cosine_similarity(
            [self.embeddings[tab_index]],
            self.embeddings
        )[0]

        # Get top N similar (excluding itself)
        similar_indices = similarities.argsort()[::-1][1:n+1]

        return self.df.iloc[similar_indices]

    def recommend_by_query(self, query, n=5):
        """Recommend tabs based on a text query."""
        # Get embedding for query
        client = OpenAI()
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=[query]
        )
        query_embedding = response.data[0].embedding

        # Calculate similarity to all tabs
        similarities = cosine_similarity(
            [query_embedding],
            self.embeddings
        )[0]

        # Get top N
        top_indices = similarities.argsort()[::-1][:n]

        return self.df.iloc[top_indices]

# Example usage
recommender = TabRecommender(sample_df, embeddings)

# Find tabs similar to a specific one
print("Tabs similar to 'Python documentation':")
python_tab_idx = sample_df[sample_df['title'].str.contains('Python', case=False)].index[0]
recommendations = recommender.recommend_similar_tabs(
    sample_df.index.get_loc(python_tab_idx)
)
print(recommendations[['title', 'domain', 'timestamp']])

# Search by query
print("\nTabs related to 'machine learning tutorials':")
ml_recommendations = recommender.recommend_by_query('machine learning tutorials')
print(ml_recommendations[['title', 'domain', 'timestamp']])
```

---

## Complete Analysis Pipeline

### All-in-One Script

```python
#!/usr/bin/env python3
"""
Complete TabbyTab analysis pipeline.
Usage: python analyze_tabs.py tabs.jsonl
"""

import sys
import pandas as pd
import numpy as np
from openai import OpenAI
import anthropic
from sklearn.cluster import KMeans
import matplotlib.pyplot as plt
import seaborn as sns
from collections import Counter

def main(filepath):
    print("🔍 Loading tab history...")
    df = load_tabs(filepath)

    print(f"✅ Loaded {len(df):,} tabs")
    print(f"📅 Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")

    print("\n📊 Generating basic statistics...")
    print_statistics(df)

    print("\n🎯 Clustering topics with embeddings...")
    df, embeddings = cluster_topics(df, n_clusters=15, sample_size=500)

    print("\n📈 Creating visualizations...")
    create_visualizations(df, embeddings)

    print("\n🔬 Finding research trails...")
    trails = find_research_trails(df)
    print(f"Found {len(trails)} research trails")

    print("\n📝 Generating insights report...")
    generate_insights_report(df, 'browsing_insights.md')

    print("\n✨ Analysis complete! Check output files:")
    print("  - browsing_insights.md")
    print("  - topic_clusters.png")
    print("  - temporal_analysis.png")
    print("  - domain_interests.png")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python analyze_tabs.py tabs.jsonl")
        sys.exit(1)

    main(sys.argv[1])
```

---

## Tips for Large Datasets

### Optimize for Millions of Tabs

1. **Batch Processing**: Process embeddings in chunks
2. **Sampling**: Use stratified sampling for initial exploration
3. **Caching**: Save embeddings to disk
4. **Database**: Use DuckDB or SQLite for large datasets

```python
import duckdb

# Load JSONL into DuckDB
con = duckdb.connect('tabs.db')
con.execute("""
    CREATE TABLE tabs AS
    SELECT * FROM read_json_auto('tabs.jsonl')
""")

# Query efficiently
result = con.execute("""
    SELECT domain, COUNT(*) as visits
    FROM tabs
    WHERE timestamp > '2025-01-01'
    GROUP BY domain
    ORDER BY visits DESC
    LIMIT 10
""").fetchdf()

print(result)
```

---

## Next Steps

- **Real-time Analysis**: Set up daily/weekly automated reports
- **Dashboard**: Build with Streamlit or Plotly Dash
- **Notifications**: Get alerts when you spend too much time on certain domains
- **Cross-User Analysis**: Compare browsing patterns (anonymized)
- **Predictive Models**: Predict what you'll research next

---

**Happy analyzing! 🚀📊**

For more examples and updates, check the [GitHub repository](https://github.com/joncooper/tabbytab).
