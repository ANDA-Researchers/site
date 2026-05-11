---
layout: page
title: Software
permalink: /software/
---

{% if site.data.software.intro %}
<div class="about-intro">
  <p class="lead">{{ site.data.software.intro }}</p>
</div>
{% endif %}

{% for item in site.data.software.items %}
<section class="page-section">
  <h2 class="section-heading">[{{ item.year }}] {{ item.title }}</h2>
  {% if item.description %}
  <p>{{ item.description }}</p>
  {% endif %}
  {% if item.link %}
  <p><a class="button-link" href="{{ item.link }}" target="_blank" rel="noopener">Visit project</a></p>
  {% endif %}
  {% if item.image %}
  <img class="software-media"
       src="{{ '/images/software/' | append: item.image | relative_url }}"
       alt="{{ item.image_alt | default: item.title }}"
       loading="lazy">
  {% endif %}
</section>
{% endfor %}

<p class="page-note"><em>Last updated: {{ site.time | date: "%B %d, %Y" }}</em></p>
