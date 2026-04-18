---
layout: page
title: Team
permalink: /team/
---

<div class="page-intro">
  <p class="lead">ANDA Lab brings together researchers working across autonomous systems, machine learning, computer vision, and next-generation networking.</p>
</div>

{% for section in site.data.team.sections %}
<section class="page-section team-section">
  <h2 class="section-heading">{{ section.title }}</h2>
  <div class="member-list">
    {% for member in section.members %}
    <article class="member-card{% if section.title == 'Professor' %} professor-card{% endif %}">
      <div class="member-photo">
        <img src="{{ '/images/' | append: member.image | relative_url }}" alt="{{ member.name }}">
      </div>
      <div class="member-content">
        <h3 class="member-name">
          {% if member.link %}
          <a href="{{ member.link }}">{{ member.name }}</a>
          {% else %}
          {{ member.name }}
          {% endif %}
        </h3>
        <p class="member-meta">
          <strong>Position:</strong> {{ member.role }}
          {% if member.email %}
          <br><strong>Email:</strong> <a href="mailto:{{ member.email }}">{{ member.email }}</a>
          {% endif %}
        </p>
        {% if member.research_area %}
        <p class="member-research"><strong>Research Area:</strong> {{ member.research_area }}</p>
        {% endif %}
        {% if member.bio %}
        <p>{{ member.bio }}</p>
        {% endif %}
      </div>
    </article>
    {% endfor %}
  </div>
</section>
{% endfor %}

<section class="page-section alumni-section">
  <h2 class="section-heading">Alumni</h2>
  <ul class="alumni-list">
    {% for alumni in site.data.team.alumni %}
    <li class="alumni-item">
      {% if alumni.link %}
      <a href="{{ alumni.link }}"><strong>{{ alumni.name }}</strong></a>
      {% else %}
      <strong>{{ alumni.name }}</strong>
      {% endif %}
      <span>{{ alumni.role }}</span>
    </li>
    {% endfor %}
  </ul>
</section>
