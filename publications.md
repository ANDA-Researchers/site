---
layout: page
title: Publications
permalink: /publications/
---

<div class="publications-summary">
  <div class="pub-stat">
    <span class="pub-stat-number">{{ site.data.publications.total_publications }}</span>
    <span class="pub-stat-label">Publications</span>
  </div>
  <div class="pub-stat">
    <span class="pub-stat-number">{{ site.data.publications.total_citations }}</span>
    <span class="pub-stat-label">Citations</span>
  </div>
  <div class="pub-stat">
    <span class="pub-stat-number">{{ site.data.publications.h_index }}</span>
    <span class="pub-stat-label">h-index</span>
  </div>
  <a href="{{ site.data.publications.scholar_url }}" class="pub-scholar-link" target="_blank">
    View on Google Scholar
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
  </a>
</div>

<p class="pub-updated">Last synced: {{ site.data.publications.last_updated }}</p>

{% for year_group in site.data.publications.publications %}
<section class="publication-section">
  <h2 class="publication-year">{{ year_group.year }}</h2>
  <ul class="publication-list">
    {% for pub in year_group.entries %}
    <li class="publication-item" data-description="{{ pub.description | escape }}" data-authors="{{ pub.authors | escape }}" data-venue="{{ pub.venue | escape }}" data-cited="{{ pub.cited_by }}" data-year="{{ year_group.year }}">
      <a href="{{ pub.url }}" target="_blank">{{ pub.title }}</a>
      <div class="pub-meta">
        <span class="pub-authors">{{ pub.authors }}</span>
        {% if pub.venue != "" %}<span class="pub-venue">{{ pub.venue }}</span>{% endif %}
        {% if pub.cited_by > 0 %}<span class="pub-cited-by">{{ pub.cited_by }} citations</span>{% endif %}
      </div>
    </li>
    {% endfor %}
  </ul>
</section>
{% endfor %}

<div class="pub-tooltip" id="pubTooltip"></div>

<script src="{{ '/assets/js/pub-tooltip.js' | relative_url }}"></script>
