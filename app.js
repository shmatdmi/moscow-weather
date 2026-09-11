(function () {
  'use strict';

  const W = window.Weather;
  const grid = document.getElementById('weatherGrid');
  const template = document.getElementById('weatherCardTemplate');
  const globalError = document.getElementById('globalError');
  const dialog = document.getElementById('forecastDialog');
  const closeButton = document.getElementById('dialogClose');
  const rangeSwitcher = document.getElementById('rangeSwitcher');
  const canvas = document.getElementById('temperatureChart');
  const chartWrap = document.getElementById('chartWrap');
  const chartLoading = document.getElementById('chartLoading');
  const chartError = document.getElementById('chartError');
  const cards = new Map();
  const observations = new Map();
  const forecasts = new Map();

  let activeCity = null;
  let activeDays = 1;
  let activeForecast = null;
  let resizeTimer;

  W.cities.forEach((city) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.setAttribute('aria-label', `Открыть график температуры: ${city.name}`);
    card.querySelector('.city').textContent = city.name;
    card.querySelector('.country').textContent = city.country;
    card.addEventListener('click', () => openForecast(city));
    grid.append(card);
    cards.set(city.slug, card);
  });

  async function updateCity(city) {
    const card = cards.get(city.slug);
    try {
      const data = await W.fetchWeather(city);
      observations.set(city.slug, data);
      card.querySelector('.description').textContent = W.capitalize(data.weather?.[0]?.description);
      card.querySelector('.temperature-value').textContent = W.number(data.main?.temp);
      card.querySelector('.wind').textContent = W.number(data.wind?.speed);
      card.querySelector('.feels').textContent = W.number(data.main?.feels_like);
      card.querySelector('.weather-icon').textContent = W.symbol(data.weather?.[0]?.id);
      card.querySelector('.updated').textContent = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date());
      card.classList.remove('offline');
    } catch (error) {
      card.classList.add('offline');
      card.querySelector('.description').textContent = 'Данные временно недоступны';
      throw error;
    }
  }

  async function loadCards() {
    globalError.classList.remove('visible');
    const results = await Promise.allSettled(W.cities.map(updateCity));
    const failed = results.filter((item) => item.status === 'rejected').length;
    if (failed) {
      globalError.textContent = `Не удалось обновить ${failed} город(а). Следующая попытка через минуту.`;
      globalError.classList.add('visible');
    }
  }

  async function fetchForecast(city) {
    if (forecasts.has(city.slug)) return forecasts.get(city.slug);

    const observation = observations.get(city.slug) || await W.fetchWeather(city);
    observations.set(city.slug, observation);
    const latitude = observation.coord?.lat;
    const longitude = observation.coord?.lon;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('не найдены координаты города');

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude,
      longitude,
      hourly: 'temperature_2m',
      forecast_days: '7',
      timezone: 'auto'
    });

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`сервис прогноза ответил с кодом ${response.status}`);
    const data = await response.json();
    if (!data.hourly?.time?.length || !data.hourly?.temperature_2m?.length) throw new Error('почасовой прогноз пуст');

    const forecast = data.hourly.time.map((time, index) => ({
      time,
      temperature: data.hourly.temperature_2m[index]
    })).filter((point) => Number.isFinite(point.temperature));
    if (!forecast.length) throw new Error('в почасовом прогнозе нет температур');
    forecasts.set(city.slug, forecast);
    return forecast;
  }

  async function openForecast(city) {
    activeCity = city;
    activeDays = 1;
    activeForecast = null;
    document.getElementById('chartCountry').textContent = `${city.country} · почасовой прогноз`;
    document.getElementById('chartTitle').textContent = city.name;
    document.getElementById('chartSummary').textContent = 'Загружаем прогноз температуры…';
    document.getElementById('detailLink').href = `weather.html?city=${encodeURIComponent(city.slug)}`;
    document.getElementById('chartRange').textContent = 'Сегодня с 00:00';
    setActiveRange();
    chartError.classList.remove('visible');
    chartLoading.hidden = false;
    canvas.hidden = true;
    showForecastDialog();

    try {
      activeForecast = await fetchForecast(city);
      if (activeCity !== city) return;
      document.getElementById('chartSummary').textContent = 'По местному времени · шаг 1 час';
      chartLoading.hidden = true;
      canvas.hidden = false;
      drawChart();
    } catch (error) {
      if (activeCity !== city) return;
      chartLoading.hidden = true;
      chartError.textContent = `Не удалось построить график: ${error.message}. Попробуйте открыть город ещё раз.`;
      chartError.classList.add('visible');
    }
  }

  function setActiveRange() {
    rangeSwitcher.querySelectorAll('button').forEach((button) => {
      const active = Number(button.dataset.days) === activeDays;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  rangeSwitcher.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-days]');
    if (!button || !activeForecast) return;
    activeDays = Math.min(7, Math.max(1, Number(button.dataset.days)));
    setActiveRange();
    document.getElementById('chartRange').textContent = activeDays === 1
      ? 'Сегодня с 00:00'
      : `${activeDays} ${activeDays === 3 ? 'дня' : 'дней'} с 00:00`;
    drawChart();
  });

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
  }

  function showForecastDialog() {
    if (dialog.hasAttribute('open')) return;

    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal();
        document.body.classList.add('dialog-open');
        return;
      } catch (error) {
        // Use the CSS fallback below when the browser exposes an incomplete dialog API.
      }
    }

    dialog.setAttribute('open', '');
    dialog.classList.add('fallback-open');
    document.body.classList.add('dialog-open');
  }

  function handleDialogClosed() {
    activeCity = null;
    chartError.classList.remove('visible');
    document.body.classList.remove('dialog-open');
  }

  function closeForecastDialog() {
    if (!dialog.hasAttribute('open')) return;
    if (dialog.classList.contains('fallback-open') || typeof dialog.close !== 'function') {
      dialog.removeAttribute('open');
      dialog.classList.remove('fallback-open');
      handleDialogClosed();
      return;
    }
    dialog.close();
  }

  function drawChart() {
    if (!activeForecast) return;
    const points = activeForecast.slice(0, activeDays * 24);
    const cssWidth = Math.max(chartWrap.clientWidth - 2, activeDays === 1 ? 620 : activeDays * 410);
    const cssHeight = window.matchMedia('(max-width: 580px)').matches ? 300 : 330;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);

    const padding = { top: 34, right: 26, bottom: 48, left: 48 };
    const plotWidth = cssWidth - padding.left - padding.right;
    const plotHeight = cssHeight - padding.top - padding.bottom;
    const values = points.map((point) => point.temperature);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const min = Math.floor(rawMin - 2);
    const max = Math.ceil(rawMax + 2);
    const range = Math.max(4, max - min);
    const xFor = (index) => padding.left + (index / Math.max(1, points.length - 1)) * plotWidth;
    const yFor = (value) => padding.top + (1 - (value - min) / range) * plotHeight;

    context.clearRect(0, 0, cssWidth, cssHeight);
    context.font = '11px Inter, system-ui, sans-serif';
    context.textBaseline = 'middle';

    for (let line = 0; line <= 4; line += 1) {
      const value = min + (range * line / 4);
      const y = yFor(value);
      context.strokeStyle = 'rgba(24,52,66,.11)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(padding.left, y);
      context.lineTo(cssWidth - padding.right, y);
      context.stroke();
      context.fillStyle = '#58717c';
      context.textAlign = 'right';
      context.fillText(`${Math.round(value)}°`, padding.left - 10, y);
    }

    points.forEach((point, index) => {
      const hour = Number(point.time.slice(11, 13));
      if (hour === 0 && index > 0) {
        const x = xFor(index);
        context.strokeStyle = 'rgba(61,121,101,.28)';
        context.setLineDash([4, 5]);
        context.beginPath();
        context.moveTo(x, padding.top);
        context.lineTo(x, padding.top + plotHeight);
        context.stroke();
        context.setLineDash([]);
      }
      const labelStep = activeDays === 1 ? 3 : activeDays === 3 ? 6 : 12;
      if (index % labelStep === 0) {
        context.fillStyle = '#58717c';
        context.textAlign = 'center';
        const date = new Date(`${point.time}:00`);
        const label = hour === 0 && index > 0
          ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
          : point.time.slice(11, 16);
        context.fillText(label, xFor(index), cssHeight - 20);
      }
    });

    const gradient = context.createLinearGradient(0, padding.top, 0, padding.top + plotHeight);
    gradient.addColorStop(0, 'rgba(61,121,101,.35)');
    gradient.addColorStop(1, 'rgba(61,121,101,.02)');
    context.beginPath();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point.temperature);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.lineTo(xFor(points.length - 1), padding.top + plotHeight);
    context.lineTo(xFor(0), padding.top + plotHeight);
    context.closePath();
    context.fillStyle = gradient;
    context.fill();

    context.beginPath();
    points.forEach((point, index) => {
      const x = xFor(index);
      const y = yFor(point.temperature);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = '#3d7965';
    context.lineWidth = 3;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();

    points.forEach((point, index) => {
      if (index % (activeDays === 1 ? 3 : 6) !== 0 && index !== points.length - 1) return;
      const x = xFor(index);
      const y = yFor(point.temperature);
      context.fillStyle = '#f7fbf6';
      context.strokeStyle = '#3d7965';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, 4, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });

    const high = Math.max(...values);
    const low = Math.min(...values);
    document.getElementById('chartSummary').textContent = `От ${W.number(low)}° до ${W.number(high)}° · по местному времени`;
    canvas.setAttribute('aria-label', `График температуры для города ${activeCity.name}: минимум ${W.number(low)} градусов, максимум ${W.number(high)} градусов, период ${activeDays} дней`);
    chartWrap.scrollLeft = 0;
  }

  closeButton.addEventListener('click', closeForecastDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeForecastDialog();
  });
  dialog.addEventListener('close', handleDialogClosed);
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (dialog.hasAttribute('open') && activeForecast) drawChart();
    }, 120);
  });

  loadCards();
  setInterval(loadCards, 60000);
})();
