---
layout: page
title: Lab Life
permalink: /lablife/
---

{% assign entries = site.data.lablife.entries | sort: "date" | reverse %}

<div class="page-intro">
  <p class="lead">Moments from our lab — research milestones, celebrations, workshops, and everyday life at ANDA.</p>
</div>

{% if entries.size > 0 %}
<p class="lablife-count">Total <strong>{{ entries.size }}</strong> {{ entries.size | pluralize: 'entry', 'entries' }}</p>

<div class="lablife-grid">
  {% for entry in entries %}
  <article class="lablife-card" data-title="{{ entry.title | escape }}" data-date="{{ entry.date }}" data-desc="{{ entry.description | escape }}" data-cover="{% if entry.cover %}{{ '/images/lablife/' | append: entry.cover | relative_url }}{% endif %}">
    <div class="lablife-card-img">
      {% if entry.cover %}
      <img src="{{ '/images/lablife/' | append: entry.cover | relative_url }}" alt="{{ entry.title }}">
      {% else %}
      <div class="lablife-card-no-img">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9l4-4 4 4 4-6 4 4"/><circle cx="8" cy="14" r="2"/></svg>
      </div>
      {% endif %}
    </div>
    <div class="lablife-card-body">
      <h3 class="lablife-card-title">{{ entry.title }}</h3>
      <p class="lablife-card-date">
        <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path fill-rule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clip-rule="evenodd"/></svg>
        {{ entry.date }}
      </p>
    </div>
  </article>
  {% endfor %}
</div>

{% else %}
<div style="text-align:center;padding:4rem 0;color:var(--light-text)">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" style="margin:0 auto 1rem;display:block;opacity:0.3"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9l4-4 4 4 4-6 4 4"/><circle cx="8" cy="14" r="2"/></svg>
  <p>No entries yet — check back soon!</p>
</div>
{% endif %}

<!-- Lightbox -->
<div class="lablife-lightbox" id="lablife-lightbox" aria-hidden="true">
  <button class="lablife-lightbox-close" id="lablife-lb-close" aria-label="Close">
    <svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
  </button>
  <div class="lablife-lightbox-inner">
    <img class="lablife-lightbox-img" id="lablife-lb-img" src="" alt="">
    <div class="lablife-lightbox-meta">
      <h3 class="lablife-lightbox-title" id="lablife-lb-title"></h3>
      <p class="lablife-lightbox-date" id="lablife-lb-date"></p>
      <p class="lablife-lightbox-desc" id="lablife-lb-desc"></p>
    </div>
  </div>
</div>

<script>
(function() {
  var lightbox = document.getElementById('lablife-lightbox');
  var lbImg = document.getElementById('lablife-lb-img');
  var lbTitle = document.getElementById('lablife-lb-title');
  var lbDate = document.getElementById('lablife-lb-date');
  var lbDesc = document.getElementById('lablife-lb-desc');

  document.querySelectorAll('.lablife-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var cover = card.dataset.cover;
      if (!cover) return;
      lbImg.src = cover;
      lbImg.alt = card.dataset.title;
      lbTitle.textContent = card.dataset.title;
      lbDate.textContent = card.dataset.date;
      lbDesc.textContent = card.dataset.desc || '';
      lbDesc.style.display = card.dataset.desc ? 'block' : 'none';
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  document.getElementById('lablife-lb-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', function(e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLightbox();
  });
})();
</script>
