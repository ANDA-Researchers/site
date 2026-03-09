---
layout: page
title: Projects
permalink: /projects/
---

<div class="about-intro">
  <p class="lead">{{ site.data.projects.intro }}</p>
</div>

{% for section in site.data.projects.sections %}
<section class="page-section">
  <h2 class="section-heading">{{ section.title }}</h2>
  <div class="project-list">
    {% for project in section.projects %}
    <article class="project-card">
      <div class="project-visual">
        <img src="{{ '/images/sub/' | append: project.image | relative_url }}" alt="{{ project.image_alt }}">
      </div>
      <div class="project-content">
        <h3>{{ project.title }}</h3>
        <p class="project-detail"><strong>Timeline:</strong> {{ project.timeline }}</p>
        <p class="project-detail"><strong>Status:</strong> {{ project.status }}</p>
        <p class="project-detail"><strong>Representatives:</strong> {{ project.representatives | join: ', ' }}</p>
        <div class="project-funding">
          <img src="{{ '/images/sub/' | append: project.funding_image | relative_url }}" alt="{{ project.funding_alt }}">
          <p>{{ project.funding_text }}</p>
        </div>
      </div>
    </article>
    {% endfor %}
  </div>
</section>
{% endfor %}

<div class="section-divider"></div>

<div class="contact-info">
  <h3>Interested in Collaborating?</h3>
  <p>{{ site.data.projects.collaborationCta }} <a href="{{ '/contact/' | relative_url }}">contact us</a>.</p>
</div>

<p class="page-note"><em>Last updated: {{ site.time | date: "%B %d, %Y" }}</em></p>
