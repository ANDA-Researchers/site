---
layout: page
title: Contact
permalink: /contact/
---

<div class="contact-hero">
  <div class="contact-hero-map">
    <div id="leaflet-map"></div>
    <div class="map-nav-buttons">
      <a href="https://maps.app.goo.gl/DUrdeyab2ryxP1VN6" target="_blank" class="map-nav-btn">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/>
          <circle cx="12" cy="9" r="2.8" fill="#fff"/>
        </svg>
        Google Maps
      </a>
      <a href="https://map.naver.com/p/entry/place/19022584" target="_blank" class="map-nav-btn">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="5" fill="#03C75A"/>
          <path d="M13.2 12.4L10.7 8H8v8h2.8v-4.4L13.3 16H16V8h-2.8v4.4z" fill="#fff"/>
        </svg>
        Naver Map
      </a>
    </div>
  </div>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  var lat = 37.4957479, lng = 126.9561148;
  var map = L.map('leaflet-map', { zoomControl: true, scrollWheelZoom: false }).setView([lat, lng], 17);
  var mapEl = document.getElementById('leaflet-map');
  mapEl.addEventListener('mouseenter', function() { map.scrollWheelZoom.enable(); });
  mapEl.addEventListener('mouseleave', function() { map.scrollWheelZoom.disable(); });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  var icon = L.divIcon({
    className: '',
    html: '<div style="width:14px;height:14px;background:var(--accent-color,#c0392b);border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });
  L.marker([lat, lng], { icon: icon }).addTo(map).bindPopup('<b>ANDA Lab</b><br>Hyungnam Engineering Building<br>Soongsil University').openPopup();
})();
</script>
  <div class="contact-hero-info">
    <div class="contact-detail">
      <div class="contact-detail-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <h3>Location</h3>
        <p>Room 1103 Hyungnam Memorial Engineering Building<br>
        Soongsil University<br>
        369 Sangdo-ro, Dongjak-gu<br>
        Seoul 06978, South Korea</p>
      </div>
    </div>
    <div class="contact-detail">
      <div class="contact-detail-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
      </div>
      <div>
        <h3>Email</h3>
        <p><a href="mailto:hpnq.work@outlook.com">hpnq.work@outlook.com</a></p>
      </div>
    </div>
    <div class="contact-detail">
      <div class="contact-detail-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      </div>
      <div>
        <h3>Lab Website</h3>
        <p><a href="https://anda-researchers.github.io/site/" target="_blank">anda-researchers.github.io/site</a></p>
      </div>
    </div>
  </div>
</div>
