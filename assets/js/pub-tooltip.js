(function() {
  var tooltip = document.getElementById('pubTooltip');
  if (!tooltip) return;
  var items = document.querySelectorAll('.publication-item');
  var active = false;

  function show(e) {
    var item = e.currentTarget;
    var title = item.querySelector('a').textContent;
    var desc = item.getAttribute('data-description') || '';
    var authors = item.getAttribute('data-authors') || '';
    var venue = item.getAttribute('data-venue') || '';
    var cited = item.getAttribute('data-cited') || '0';
    var year = item.getAttribute('data-year') || '';

    var html = '<div class="pub-tip-title">' + title + '</div>';
    if (authors) html += '<div class="pub-tip-authors">' + authors + '</div>';
    if (venue) html += '<div class="pub-tip-venue">' + venue + (year ? ' (' + year + ')' : '') + '</div>';
    if (parseInt(cited) > 0) html += '<div class="pub-tip-cited">' + cited + ' citations</div>';
    if (desc) html += '<div class="pub-tip-desc">' + desc + '</div>';

    tooltip.innerHTML = html;
    tooltip.classList.add('visible');
    active = true;
    position(e);
  }

  function position(e) {
    if (!active) return;
    var header = document.querySelector('.site-header');
    var headerH = header ? header.offsetHeight : 0;
    var x = e.clientX + 16;
    var y = e.clientY + 16;
    var tw = tooltip.offsetWidth;
    var th = tooltip.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    if (x + tw > vw - 12) x = e.clientX - tw - 16;
    if (y + th > vh - 12) y = e.clientY - th - 16;
    if (x < 8) x = 8;
    if (y < headerH + 8) y = headerH + 8;

    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function hide() {
    active = false;
    tooltip.classList.remove('visible');
  }

  for (var i = 0; i < items.length; i++) {
    items[i].addEventListener('mouseenter', show);
    items[i].addEventListener('mousemove', position);
    items[i].addEventListener('mouseleave', hide);
  }
})();
