---
layout: default
---

<section class="hero-section" data-scene-state="hero">
  <div class="aurora-glow" aria-hidden="true"></div>
  <div class="content-block">
    <div class="reveal-mask fit-content">
      <h1 class="hero-title-top">Pioneering</h1>
    </div>
    <div class="reveal-mask fit-content">
      <h1 class="hero-title-bottom">Intelligence<span class="accent-dot">.</span></h1>
    </div>
    <div class="reveal-mask">
      <p class="fade-up">Exploring the bleeding edge of autonomous vehicles, machine learning, and next-generation networks.</p>
    </div>
    <div class="reveal-mask">
      <div class="lab-badge fade-up">
        <span class="badge-line"></span>
        <span>ANDA Lab &mdash; Soongsil University</span>
      </div>
    </div>
  </div>
  <div class="scroll-indicator fade-up">
    <span>Scroll to explore</span>
    <div class="scroll-line">
      <div class="scroll-line-fill"></div>
    </div>
  </div>
</section>

<section class="transition-section" data-scene-state="dissolve">
  <div class="content-block centered">
    <div class="reveal-mask">
      <p class="large-quote">"Where perception meets precision."</p>
    </div>
  </div>
</section>

<section class="info-section" data-scene-state="autonomous">
  <div class="content-block">
    <div class="reveal-mask">
      <div class="section-label">
        <span class="label-number">01</span>
        <span class="label-line"></span>
        <span class="label-text">Research</span>
      </div>
    </div>
    <div class="reveal-mask">
      <h2>Autonomous</h2>
    </div>
    <div class="reveal-mask">
      <h2>Future</h2>
    </div>
    <div class="reveal-mask">
      <p class="fade-up">Engineering robust perception, control systems, and 4D LiDAR panoptic tracking to bridge the gap between human intuition and machine precision.</p>
    </div>
    <div class="reveal-mask">
      <a href="{{ '/projects/' | relative_url }}" class="link-arrow fade-up">
        <span>View Projects</span>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </a>
    </div>
  </div>
</section>

<section class="transition-section" data-scene-state="networks">
  <div class="content-block centered">
    <div class="reveal-mask">
      <p class="large-quote">"Infrastructure for the intelligent edge."</p>
    </div>
  </div>
</section>

<section class="info-section center-aligned" data-scene-state="networks">
  <div class="content-block">
    <div class="reveal-mask">
      <div class="section-label">
        <span class="label-number">02</span>
        <span class="label-line"></span>
        <span class="label-text">Research</span>
      </div>
    </div>
    <div class="reveal-mask">
      <h2>Next-Gen</h2>
    </div>
    <div class="reveal-mask">
      <h2>Networks</h2>
    </div>
    <div class="reveal-mask">
      <p class="fade-up">Designing intelligent edge/cloud computing infrastructures and 6G technologies capable of handling the massive data influx of tomorrow.</p>
    </div>
    <div class="reveal-mask">
      <a href="{{ '/publications/' | relative_url }}" class="link-arrow fade-up">
        <span>Read Publications</span>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </a>
    </div>
  </div>
</section>

{% assign researcher_count = 0 %}
{% for section in site.data.team.sections %}
  {% assign researcher_count = researcher_count | plus: section.members.size %}
{% endfor %}

{% assign active_projects = 0 %}
{% for section in site.data.projects.sections %}
  {% for project in section.projects %}
    {% if project.status == "Ongoing" %}
      {% assign active_projects = active_projects | plus: 1 %}
    {% endif %}
  {% endfor %}
{% endfor %}

<section class="stats-section" data-scene-state="networks">
  <div class="stats-grid fade-up">
    <div class="stat-item">
      <span class="stat-number">{{ site.data.publications.total_publications }}+</span>
      <span class="stat-label">Publications</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">{{ researcher_count }}</span>
      <span class="stat-label">Researchers</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">{{ active_projects }}</span>
      <span class="stat-label">Active Projects</span>
    </div>
  </div>
</section>

<section class="info-section right-aligned" data-scene-state="final">
  <div class="content-block">
    <div class="reveal-mask">
      <div class="section-label">
        <span class="label-number">03</span>
        <span class="label-line"></span>
        <span class="label-text">Collaborate</span>
      </div>
    </div>
    <div class="reveal-mask">
      <h2>Join the</h2>
    </div>
    <div class="reveal-mask">
      <h2>Lab<span class="accent-dot">.</span></h2>
    </div>
    <div class="reveal-mask">
      <p class="fade-up">We are always looking for motivated researchers and students passionate about pushing the frontiers of technology.</p>
    </div>
    <div class="reveal-mask">
      <a href="{{ '/joinus/' | relative_url }}" class="link-arrow fade-up">
        <span>Learn More</span>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
      </a>
    </div>
  </div>
</section>

<section class="final-section" data-scene-state="final"></section>
