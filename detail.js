(function () {
  'use strict';

  const W = window.Weather;
  const params = new URLSearchParams(window.location.search);
  const citySlug = params.get('city');
  const city = W.cities.find((candidate) => candidate.slug === citySlug);
  const error = document.getElementById('detailError');
  const content = document.getElementById('detailContent');
  const jsonPanel = document.getElementById('jsonPanel');
  const refreshButton = document.getElementById('refreshButton');

  if (!city) {
    document.getElementById('detailCity').textContent = 'Город не найден';
    error.textContent = 'Откройте один из городов с главной страницы.';
    error.classList.add('visible');
    return;
  }

  document.title = `Погода в городе ${city.name}`;
  document.getElementById('detailCity').textContent = city.name;
  document.getElementById('detailCountry').textContent = city.country;
  document.getElementById('aboutTitle').textContent = `${city.name} — характер города`;
  document.getElementById('aboutText').textContent = city.about;

  const facts = city.facts.map((fact, index) => {
    const item = document.createElement('span');
    const number = document.createElement('b');
    number.textContent = String(index + 1).padStart(2, '0');
    item.append(number, document.createTextNode(fact));
    return item;
  });
  document.getElementById('factList').replaceChildren(...facts);

  function metric(label, value, note = '') {
    const article = document.createElement('article');
    article.className = 'detail-metric';
    const labelElement = document.createElement('span');
    const valueElement = document.createElement('strong');
    labelElement.textContent = label;
    valueElement.textContent = value;
    article.append(labelElement, valueElement);

    if (note) {
      const noteElement = document.createElement('small');
      noteElement.textContent = note;
      article.append(noteElement);
    }

    return article;
  }

  function duration(seconds) {
    if (!Number.isFinite(seconds)) return '—';
    return `${Math.floor(seconds / 3600)} ч ${Math.round(seconds % 3600 / 60)} мин`;
  }

  function render(data) {
    const timezone = data.timezone || 0;
    document.getElementById('detailDescription').textContent = W.capitalize(data.weather?.[0]?.description);
    document.getElementById('detailTemp').textContent = W.number(data.main?.temp);
    document.getElementById('observedAt').textContent = `Наблюдение: ${W.localDate(data.dt, timezone, {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    })}`;

    document.getElementById('metricGrid').replaceChildren(
      metric('Ощущается', `${W.number(data.main?.feels_like)} °C`, `минимум ${W.number(data.main?.temp_min)}° · максимум ${W.number(data.main?.temp_max)}°`),
      metric('Влажность', `${W.number(data.main?.humidity, 0)}%`, 'относительная влажность'),
      metric('Давление', `${W.number(data.main?.pressure, 0)} гПа`, `${W.number(data.main?.pressure * 0.750062, 0)} мм рт. ст.`),
      metric('Ветер', `${W.number(data.wind?.speed)} м/с`, `${W.windDirection(data.wind?.deg)}${Number.isFinite(data.wind?.gust) ? ` · порывы ${W.number(data.wind.gust)} м/с` : ''}`),
      metric('Видимость', `${W.number(data.visibility / 1000)} км`, 'горизонтальная'),
      metric('Облачность', `${W.number(data.clouds?.all, 0)}%`, W.capitalize(data.weather?.[0]?.description))
    );

    document.getElementById('sunrise').textContent = W.localDate(data.sys?.sunrise, timezone, { hour: '2-digit', minute: '2-digit' });
    document.getElementById('sunset').textContent = W.localDate(data.sys?.sunset, timezone, { hour: '2-digit', minute: '2-digit' });
    document.getElementById('dayLength').textContent = duration(data.sys?.sunset - data.sys?.sunrise);
    document.getElementById('coordinates').textContent = `${W.number(data.coord?.lat, 4)}°, ${W.number(data.coord?.lon, 4)}°`;
    document.getElementById('rawJson').textContent = JSON.stringify(data, null, 2);
    content.hidden = false;
    jsonPanel.hidden = false;
  }

  async function load() {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Обновляем…';
    error.classList.remove('visible');
    try {
      render(await W.fetchWeather(city));
    } catch (loadError) {
      error.textContent = `Не удалось получить погоду: ${loadError.message}. Попробуйте ещё раз.`;
      error.classList.add('visible');
    } finally {
      refreshButton.disabled = false;
      refreshButton.textContent = 'Обновить';
    }
  }

  refreshButton.addEventListener('click', load);
  load();
})();
