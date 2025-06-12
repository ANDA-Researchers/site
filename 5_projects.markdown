---
layout: page
title: Projects
permalink: /projects/
---

<style>
  .project-row {
    margin-bottom: 2rem;
  }

  .project-container {
    background-color: var(--light-background);
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 3px solid var(--accent-color);
    transition: transform var(--transition-speed) ease, box-shadow var(--transition-speed) ease;
  }

  .project-container:hover {
    transform: translateY(-5px);
    box-shadow: var(--box-shadow);
  }

  .project-img {
    float: right;
    max-width: 200px;
    margin-left: 1.5rem;
    margin-bottom: 1rem;
  }

  .project-img img {
    width: 100%;
    border-radius: 6px;
    box-shadow: var(--box-shadow);
  }

  .project-text {
    overflow: hidden;
  }

  .project-text p {
    margin-bottom: 1rem;
    color: var(--text-color);
  }

  .project-text table {
    margin-bottom: 0;
    border: none;
  }

  .project-text table td {
    padding: 0.5rem 0;
    border: none;
    vertical-align: middle;
  }

  /* Responsive adjustments */
  @media screen and (max-width: 768px) {
    .project-img {
      float: none;
      margin-left: 0;
      margin-bottom: 1.5rem;
      max-width: 100%;
    }
  }
</style>

<div class="about-intro">
  <p class="lead">Our research lab is involved in various innovative projects across different domains. Below you'll find information about our active and completed projects, including funding details and project timelines.</p>
</div>

<h2>Active Projects</h2>

<div class="project-row">
  <div class="project-container">
    <h3><b>A research on the core technologies for securing fully autonomous driving by cooperation between vehicles and edge computing
</b></h3>
    <div class="project-img">
      <img src="{{ site.baseurl }}/images/sub/ap1.png" alt="AP 1" title="AP 1" width="100">
    </div>
    <div class="project-text">
      <p>Ongoing 2024-2028</p>
      <p>Representatives: Ngoc-Quan Ha-Phan, Khoi Anh Bui, Hung Viet Vuong</p>
      <table><tbody><tr><td><span style="padding-right: 10px"> <img src="{{ site.baseurl }}/images/sub/nrf.png" alt="funding" title="funding" width="100"></span></td>
        <td>Funded by NRF-MSIT (RS-2024-00335137)</td>
      </tr></tbody></table>
    </div>
  </div>
</div>

<div class="project-row">
  <div class="project-container">
    <h3><b>Development of Candidate Element Technology for Intelligent 6G Mobile Core Network</b></h3>
    <div class="project-img">
      <img src="{{ site.baseurl }}/images/sub/ap1.png" alt="AP 1" title="AP 1" width="100">
    </div>
    <div class="project-text">
      <p>Ongoing 2024-2028</p>
      <p>Representatives: Khoi Anh Bui</p>
      <table><tbody><tr><td><span style="padding-right: 10px"> <img src="{{ site.baseurl }}/images/sub/nrf.png" alt="funding" title="funding" width="100"></span></td>
        <td>Funded by NRF-MSIT (RS-2024-00335137)</td>
      </tr></tbody></table>
    </div>
  </div>
</div>

<div class="project-row">
  <div class="project-container">
    <h3><b>Development of 6H Next Generation Mobile Communications Technology</b></h3>
    <div class="project-img">
      <img src="{{ site.baseurl }}/images/sub/ap1.png" alt="AP 1" title="AP 1" width="100">
    </div>
    <div class="project-text">
      <p>Ongoing 2024-2028</p>
      <p>Representatives: Khoi Anh Bui</p>
      <table><tbody><tr><td><span style="padding-right: 10px"> <img src="{{ site.baseurl }}/images/sub/nrf.png" alt="funding" title="funding" width="100"></span></td>
        <td>Funded by NRF-MSIT (RS-2024-00335137)</td>
      </tr></tbody></table>
    </div>
  </div>
</div>



<!-- <h2>Completed Projects</h2>

<div class="project-row">
  <div class="project-container">
    <h3><b>CP 1</b></h3>
    <div class="project-img">
      <img src="{{ site.baseurl }}/images/project-placeholder.jpg" alt="CP 1" title="CP 1">
    </div>
    <div class="project-text">
      <p>Description for Completed Project 1 goes here. This section should include a brief overview of the project, its goals, outcomes, and its significance. The text should provide enough detail to give visitors an understanding of the project's scope, achievements, and impact.</p>
      <table><tbody><tr><td><span style="padding-right: 10px"> <img src="{{ site.baseurl }}/images/funding-icon.png" alt="funding" title="funding" width="45"></span></td>
        <td>Funded by [Funding Source] 20XX-20XX.</td>
      </tr></tbody></table>
    </div>
  </div>
</div> -->



<div class="section-divider"></div>

<div class="contact-info">
  <h3>Interested in Collaborating?</h3>
  <p>If you're interested in collaborating on any of these projects or have ideas for new research directions, please <a href="{{ site.baseurl }}/contact/">contact us</a>.</p>
</div>

---

_Last updated: {{ site.time | date: "%B %d, %Y" }}_
