---
layout: page
title: Publications
permalink: /publications/
---

<p class="lead">Selected journal articles, conference papers, and patents authored by ANDA Lab members.</p>

{% for year_group in site.data.publications %}
<section class="publication-section">
  <h2 class="publication-year">{{ year_group.year }}</h2>
  <ul class="publication-list">
    {% for publication in year_group.entries %}
    <li class="publication-item">
      <a href="{{ publication.url }}">{{ publication.title }}</a>
      <p>{{ publication.citation }}</p>
    </li>
    {% endfor %}
  </ul>
</section>
{% endfor %}
