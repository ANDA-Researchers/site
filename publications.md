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

<nav class="year-nav" id="year-nav" aria-label="Jump to year">
  {% for year_group in site.data.publications.publications %}
  <a href="#year-{{ year_group.year }}" class="year-nav-item" data-year="{{ year_group.year }}">{% if year_group.year == 0 %}Other{% else %}{{ year_group.year }}{% endif %}</a>
  {% endfor %}
</nav>

{% for year_group in site.data.publications.publications %}
<section class="publication-section" id="year-{{ year_group.year }}">
  <h2 class="publication-year">{% if year_group.year == 0 %}Other{% else %}{{ year_group.year }}{% endif %}</h2>
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
<script>
(function() {
  var nav = document.getElementById('year-nav');
  if (!nav) return;
  var items = nav.querySelectorAll('.year-nav-item');
  var sections = document.querySelectorAll('.publication-section');

  // Smooth scroll on click
  items.forEach(function(item) {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      var target = document.querySelector(item.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Scroll spy — highlight active year
  var ticking = false;
  function updateActive() {
    var scrollY = window.scrollY + 160;
    var current = null;
    sections.forEach(function(sec) {
      if (sec.offsetTop <= scrollY) current = sec.id;
    });
    items.forEach(function(item) {
      var isActive = item.getAttribute('href') === '#' + current;
      item.classList.toggle('active', isActive);
      if (isActive) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
    ticking = false;
  }

  window.addEventListener('scroll', function() {
    if (!ticking) { ticking = true; requestAnimationFrame(updateActive); }
  });
  updateActive();
})();
</script>
