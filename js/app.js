const TYPE_ORDER = ["官立", "資助", "直資", "私立"];

/** Haversine great-circle distance in metres */
export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} 米`;
  }
  if (meters < 10000) {
    return `${(meters / 1000).toFixed(2)} 公里`;
  }
  return `${(meters / 1000).toFixed(1)} 公里`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizePhoneHref(phone) {
  return phone.replace(/\s+/g, "");
}

function ensureUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function formatHongKongDateRange(start, end, isDateTime) {
  if (!start) return "日期待定";
  const optsDate = { timeZone: "Asia/Hong_Kong", year: "numeric", month: "numeric", day: "numeric" };
  const optsTime = { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit", hour12: false };

  if (!isDateTime) {
    const startLabel = new Date(`${start}T12:00:00+08:00`).toLocaleDateString("zh-HK", optsDate);
    if (!end || end === start) return startLabel;
    const endLabel = new Date(`${end}T12:00:00+08:00`).toLocaleDateString("zh-HK", optsDate);
    return `${startLabel} – ${endLabel}`;
  }

  const s = new Date(start);
  const startDate = s.toLocaleDateString("zh-HK", optsDate);
  const startTime = s.toLocaleTimeString("zh-HK", optsTime);
  if (!end) return `${startDate} ${startTime}`;
  const e = new Date(end);
  const endDate = e.toLocaleDateString("zh-HK", optsDate);
  const endTime = e.toLocaleTimeString("zh-HK", optsTime);
  if (startDate === endDate) return `${startDate}\n${startTime}–${endTime}`;
  return `${startDate} ${startTime}\n– ${endDate} ${endTime}`;
}

class App {
  constructor() {
    this.schools = [];
    this.eventsPayload = null;
    this.filterType = "all";
    this.eventStatus = "all";
    this.query = "";
    this.map = null;
    this.markers = new Map();
    this.markerLayer = null;
    this.userMarker = null;
    this.selectedLatLng = null;
    this.mapReady = false;

    this.els = {
      tabList: document.getElementById("tab-list"),
      tabEvents: document.getElementById("tab-events"),
      tabMap: document.getElementById("tab-map"),
      panelList: document.getElementById("panel-list"),
      panelEvents: document.getElementById("panel-events"),
      panelMap: document.getElementById("panel-map"),
      search: document.getElementById("search"),
      filters: document.querySelector(".filters"),
      resultCount: document.getElementById("result-count"),
      schoolList: document.getElementById("school-list"),
      eventsList: document.getElementById("events-list"),
      eventsTitle: document.getElementById("events-title"),
      eventsMeta: document.getElementById("events-meta"),
      eventsFilters: document.querySelector(".events-filters"),
      eventsNotionLinkWrap: document.getElementById("events-notion-link-wrap"),
      map: document.getElementById("map"),
      mapHint: document.getElementById("map-hint"),
      selectedPoint: document.getElementById("selected-point"),
      distanceList: document.getElementById("distance-list"),
      clearPoint: document.getElementById("clear-point"),
      cardTemplate: document.getElementById("school-card-template"),
    };
  }

  async init() {
    this.bindTabs();
    this.bindListControls();
    this.bindEventFilters();
    this.els.clearPoint.addEventListener("click", () => this.clearSelectedPoint());

    try {
      const res = await fetch("data/schools.json");
      if (!res.ok) throw new Error(`無法載入學校資料（${res.status}）`);
      this.schools = await res.json();
      this.renderList();
    } catch (err) {
      this.els.schoolList.innerHTML = `<p class="sources">載入失敗：${escapeHtml(err.message)}。請以本地伺服器開啟本站（見 README）。</p>`;
    }

    this.loadEvents();
  }

  async loadEvents() {
    try {
      const res = await fetch("data/events.json");
      if (!res.ok) throw new Error(`無法載入升中項目（${res.status}）`);
      this.eventsPayload = await res.json();
      if (this.els.eventsTitle && this.eventsPayload.title) {
        this.els.eventsTitle.textContent = this.eventsPayload.title;
      }
      const synced = this.eventsPayload.source?.syncedAt
        ? new Date(this.eventsPayload.source.syncedAt).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })
        : "—";
      this.els.eventsMeta.textContent = `Notion 同步快照 · 共 ${this.eventsPayload.events?.length || 0} 項 · 同步於 ${synced}`;
      if (this.els.eventsNotionLinkWrap && this.eventsPayload.source?.notionUrl) {
        this.els.eventsNotionLinkWrap.innerHTML = `原始 Notion：<a href="${escapeHtml(this.eventsPayload.source.notionUrl)}" target="_blank" rel="noopener noreferrer">開啟資料庫</a>`;
      }
      this.renderEvents();
    } catch (err) {
      this.els.eventsMeta.textContent = "載入失敗";
      this.els.eventsList.innerHTML = `<p class="sources">無法載入升中項目：${escapeHtml(err.message)}</p>`;
    }
  }

  bindTabs() {
    const panels = {
      list: this.els.panelList,
      events: this.els.panelEvents,
      map: this.els.panelMap,
    };
    const tabs = {
      list: this.els.tabList,
      events: this.els.tabEvents,
      map: this.els.tabMap,
    };

    const activate = (name) => {
      for (const [key, panel] of Object.entries(panels)) {
        const on = key === name;
        panel.classList.toggle("is-active", on);
        panel.hidden = !on;
        tabs[key].classList.toggle("is-active", on);
        tabs[key].setAttribute("aria-selected", String(on));
      }
      if (name === "map") {
        requestAnimationFrame(() => this.ensureMap());
      }
    };

    this.els.tabList.addEventListener("click", () => activate("list"));
    this.els.tabEvents.addEventListener("click", () => activate("events"));
    this.els.tabMap.addEventListener("click", () => activate("map"));
  }

  bindEventFilters() {
    if (!this.els.eventsFilters) return;
    this.els.eventsFilters.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-event-status]");
      if (!btn) return;
      this.eventStatus = btn.dataset.eventStatus;
      this.els.eventsFilters.querySelectorAll(".chip").forEach((chip) => {
        chip.classList.toggle("is-active", chip === btn);
      });
      this.renderEvents();
    });
  }

  renderEvents() {
    if (!this.eventsPayload?.events) return;
    const list = this.eventsPayload.events.filter((ev) => {
      if (this.eventStatus === "all") return true;
      return ev.status === this.eventStatus;
    });

    this.els.eventsList.replaceChildren();
    if (!list.length) {
      this.els.eventsList.innerHTML = `<p class="sources">此篩選條件下沒有項目。</p>`;
      return;
    }

    for (const ev of list) {
      const card = document.createElement("article");
      card.className = "event-card";

      const when = document.createElement("div");
      when.className = "event-when";
      when.textContent = formatHongKongDateRange(ev.dateStart, ev.dateEnd, ev.isDateTime);
      if (ev.keyPoints) {
        const key = document.createElement("small");
        key.textContent = `關鍵：${ev.keyPoints}`;
        when.append(key);
      }

      const body = document.createElement("div");
      body.className = "event-body";
      const title = document.createElement("h3");
      title.textContent = ev.title;
      body.append(title);

      const badges = document.createElement("div");
      badges.className = "badges";
      const typeBadge = document.createElement("span");
      typeBadge.className = `badge type-${ev.type}`;
      typeBadge.textContent = ev.type;
      badges.append(typeBadge);
      const statusBadge = document.createElement("span");
      statusBadge.className = `badge status-${ev.status}`;
      statusBadge.textContent = ev.status;
      badges.append(statusBadge);
      if (ev.schools?.length) {
        for (const school of ev.schools) {
          const s = document.createElement("span");
          s.className = "badge";
          s.textContent = school;
          badges.append(s);
        }
      }
      body.append(badges);

      if (ev.notes) {
        const notes = document.createElement("p");
        notes.textContent = ev.notes;
        body.append(notes);
      }

      const links = document.createElement("p");
      const parts = [];
      if (ev.sourceUrl) {
        parts.push(`<a href="${escapeHtml(ensureUrl(ev.sourceUrl))}" target="_blank" rel="noopener noreferrer">來源</a>`);
      }
      if (ev.notionUrl) {
        parts.push(`<a href="${escapeHtml(ev.notionUrl)}" target="_blank" rel="noopener noreferrer">Notion</a>`);
      }
      if (parts.length) {
        links.innerHTML = parts.join(" · ");
        body.append(links);
      }

      card.append(when, body);
      this.els.eventsList.append(card);
    }
  }

  bindListControls() {
    this.els.search.addEventListener("input", (e) => {
      this.query = e.target.value.trim().toLowerCase();
      this.renderList();
    });

    this.els.filters.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-type]");
      if (!btn) return;
      this.filterType = btn.dataset.type;
      this.els.filters.querySelectorAll(".chip").forEach((chip) => {
        chip.classList.toggle("is-active", chip === btn);
      });
      this.renderList();
    });
  }

  filteredSchools() {
    return this.schools.filter((s) => {
      if (this.filterType !== "all" && s.type !== this.filterType) return false;
      if (!this.query) return true;
      const hay = [
        s.nameZh,
        s.nameEn,
        s.addressZh,
        s.addressEn,
        s.type,
        s.religion,
        s.gender,
        s.bandNote || "",
        s.phone,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(this.query);
    });
  }

  renderList() {
    const list = this.filteredSchools().slice().sort((a, b) => {
      const ti = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      if (ti !== 0) return ti;
      return a.nameZh.localeCompare(b.nameZh, "zh-Hant");
    });

    this.els.resultCount.textContent = `顯示 ${list.length} / ${this.schools.length} 所中學`;
    this.els.schoolList.replaceChildren();

    for (const school of list) {
      const node = this.els.cardTemplate.content.cloneNode(true);
      const card = node.querySelector(".school-card");
      card.querySelector(".school-name").textContent = school.nameZh;
      card.querySelector(".school-name-en").textContent = school.nameEn;

      const badges = card.querySelector(".badges");
      const typeBadge = document.createElement("span");
      typeBadge.className = `badge type-${school.type}`;
      typeBadge.textContent = school.type;
      badges.append(typeBadge);

      if (school.gender && school.gender !== "男女") {
        const g = document.createElement("span");
        g.className = "badge";
        g.textContent = school.gender === "女" ? "女校" : school.gender === "男" ? "男校" : school.gender;
        badges.append(g);
      }

      if (school.religion && school.religion !== "不適用") {
        const r = document.createElement("span");
        r.className = "badge";
        r.textContent = school.religion;
        badges.append(r);
      }

      if (school.bandNote) {
        const b = document.createElement("span");
        b.className = "badge band";
        b.title = "民間參考組別，非官方評級";
        b.textContent = `民間參考 ${school.bandNote}`;
        badges.append(b);
      }

      const meta = card.querySelector(".school-meta");
      const rows = [
        ["地址", school.addressZh],
        ["電話", school.phone
          ? `<a href="tel:${normalizePhoneHref(school.phone)}">${escapeHtml(school.phone)}</a>`
          : "—"],
        ["網址", school.website
          ? `<a href="${escapeHtml(ensureUrl(school.website))}" target="_blank" rel="noopener noreferrer">${escapeHtml(school.website.replace(/^https?:\/\//i, ""))}</a>`
          : "—"],
      ];
      meta.innerHTML = rows
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
        .join("");

      const actions = card.querySelector(".school-actions");
      const mapBtn = document.createElement("button");
      mapBtn.type = "button";
      mapBtn.className = "btn btn-primary";
      mapBtn.textContent = "在地圖查看";
      mapBtn.addEventListener("click", () => this.showSchoolOnMap(school.id));
      actions.append(mapBtn);

      this.els.schoolList.append(node);
    }
  }

  ensureMap() {
    if (this.mapReady) {
      this.map.invalidateSize();
      return;
    }
    if (typeof L === "undefined") {
      this.els.selectedPoint.textContent = "地圖程式庫載入失敗，請檢查網路連線後重新整理。";
      return;
    }

    this.map = L.map(this.els.map, {
      zoomControl: true,
      attributionControl: true,
    }).setView([22.39, 114.20], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
    this.addSchoolMarkers();

    this.map.on("click", (e) => {
      this.setSelectedPoint(e.latlng.lat, e.latlng.lng);
    });

    this.mapReady = true;
    setTimeout(() => this.map.invalidateSize(), 50);
  }

  schoolIcon(isNearest = false) {
    return L.divIcon({
      className: "school-marker",
      html: `<span class="marker-dot${isNearest ? " is-nearest" : ""}"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  userIcon() {
    return L.divIcon({
      className: "user-marker",
      html: `<span class="marker-pin"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 16],
    });
  }

  addSchoolMarkers() {
    this.markerLayer.clearLayers();
    this.markers.clear();
    const bounds = [];

    for (const school of this.schools) {
      const marker = L.marker([school.lat, school.lng], {
        icon: this.schoolIcon(false),
        title: school.nameZh,
      });
      marker.bindPopup(
        `<p class="popup-title">${escapeHtml(school.nameZh)}</p>
         <p class="popup-meta">${escapeHtml(school.type)} · ${escapeHtml(school.addressZh)}</p>`,
        { maxWidth: 240 }
      );
      marker.on("click", () => {
        // keep popup; do not treat as distance origin
      });
      marker.addTo(this.markerLayer);
      this.markers.set(school.id, marker);
      bounds.push([school.lat, school.lng]);
    }

    if (bounds.length) {
      this.map.fitBounds(bounds, { padding: [28, 28] });
    }
  }

  setSelectedPoint(lat, lng) {
    this.selectedLatLng = { lat, lng };
    this.els.mapHint.classList.add("is-hidden");
    this.els.clearPoint.hidden = false;
    this.els.selectedPoint.textContent = `選取座標：${lat.toFixed(5)}, ${lng.toFixed(5)}（直線距離 · Haversine）`;

    if (this.userMarker) {
      this.userMarker.setLatLng([lat, lng]);
    } else {
      this.userMarker = L.marker([lat, lng], {
        icon: this.userIcon(),
        zIndexOffset: 1000,
        title: "選取位置",
      }).addTo(this.map);
      this.userMarker.bindPopup("你選取的參考點").openPopup();
    }

    this.renderDistances();
  }

  clearSelectedPoint() {
    this.selectedLatLng = null;
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }
    this.els.clearPoint.hidden = true;
    this.els.mapHint.classList.remove("is-hidden");
    this.els.selectedPoint.textContent = "尚未選點。請在地圖上點選參考位置。";
    this.els.distanceList.replaceChildren();
    for (const marker of this.markers.values()) {
      marker.setIcon(this.schoolIcon(false));
    }
  }

  renderDistances() {
    if (!this.selectedLatLng) return;
    const { lat, lng } = this.selectedLatLng;

    const ranked = this.schools
      .map((s) => ({
        school: s,
        meters: haversineMeters(lat, lng, s.lat, s.lng),
      }))
      .sort((a, b) => a.meters - b.meters);

    this.els.distanceList.replaceChildren();
    ranked.forEach((item, index) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="distance-rank">${index + 1}</span>
        <span>
          <span class="distance-name">${escapeHtml(item.school.nameZh)}</span>
          <span class="distance-meta">${escapeHtml(item.school.type)} · ${escapeHtml(item.school.addressZh)}</span>
        </span>
        <span class="distance-value">${formatDistance(item.meters)}</span>
      `;
      li.addEventListener("click", () => {
        const marker = this.markers.get(item.school.id);
        if (marker) {
          this.map.panTo(marker.getLatLng());
          marker.openPopup();
        }
      });
      this.els.distanceList.append(li);
    });

    const nearestId = ranked[0]?.school.id;
    for (const [id, marker] of this.markers) {
      marker.setIcon(this.schoolIcon(id === nearestId));
    }
  }

  showSchoolOnMap(schoolId) {
    this.els.tabMap.click();
    const school = this.schools.find((s) => s.id === schoolId);
    if (!school) return;
    this.ensureMap();
    const marker = this.markers.get(schoolId);
    this.map.setView([school.lat, school.lng], 16, { animate: true });
    if (marker) marker.openPopup();
  }
}

const app = new App();
app.init();
