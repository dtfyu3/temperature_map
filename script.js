
function createSpinner(container) {
    const spinner_container = document.createElement("div");
    spinner_container.id = 'loading-spinner';
    const spinner = document.createElement("div");
    spinner.classList.add('spinner');
    const span = document.createElement("span");
    span.classList.add('sr-only');
    span.textContent = 'Loading...';
    spinner_container.appendChild(spinner);
    spinner_container.appendChild(span);
    container.prepend(spinner_container);
    spinner_container.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
}
function removeSpinner() {
    if (document.getElementById('loading-spinner')) document.getElementById('loading-spinner').remove();
}

const lowerOrRiseMap = (mapZIndex) => {
    const map = document.getElementById('map');
    mapZIndex ? map.style.zIndex = mapZIndex : map.style.zIndex = -1;
}
function getTemperatureColor(temp) {
    const tempColors = [
        { temp: -50, color:"#4526f5"},
        { temp: -40, color:"#2a1de7"},
        { temp: -20, color: "#264CFF" },
        { temp: -15, color: "#3FA0FF" },
        { temp: -10, color: "#72D8FF" },
        { temp: -5, color: "#AAF7FF" },
        { temp: 0, color: "#E0FFFF" },
        { temp: 5, color: "#FFFFBF" },
        { temp: 10, color: "#FFE099" },
        { temp: 15, color: "#FFAD72" },
        { temp: 20, color: "#F76D5E" },
        { temp: 25, color: "#D82632" },
        { temp: 30, color: "#A50021" }
    ];
    if (!isNaN(Number(temp))) {
        for (let i = 0; i < tempColors.length - 1; i++) {
            if (temp <= tempColors[i].temp) return tempColors[i].color;
            if (temp < tempColors[i + 1].temp) {
                let ratio = (temp - tempColors[i].temp) / (tempColors[i + 1].temp - tempColors[i].temp);
                return interpolateColor(tempColors[i].color, tempColors[i + 1].color, ratio);
            }
        }
        return tempColors[tempColors.length - 1].color;
    }
    else return 'white';
}

function interpolateColor(color1, color2, ratio) {
    const hexToRgb = (hex) => {
        return [parseInt(hex.substring(1, 3), 16), parseInt(hex.substring(3, 5), 16), parseInt(hex.substring(5, 7), 16)];
    };
    const rgbToHex = (r, g, b) => {
        return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
    };

    let [r1, g1, b1] = hexToRgb(color1);
    let [r2, g2, b2] = hexToRgb(color2);

    let r = Math.round(r1 + (r2 - r1) * ratio);
    let g = Math.round(g1 + (g2 - g1) * ratio);
    let b = Math.round(b1 + (b2 - b1) * ratio);

    return rgbToHex(r, g, b);
}

const showCurrentLocationMarker = async (map) => {
    if (navigator.geolocation) {
        await navigator.geolocation.getCurrentPosition(success)
    }

    function success(position) {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const marker = L.marker([lat, lon]).addTo(map);
        marker.bindPopup('Вы находитесь где-то здесь');
    }
}
function countriesStyle(properties, styles = {}) {
    const { color = 'black', weight = 1, opacity = 1, fillOpacity = 1, fill = false, stroke = false } = styles;
    return {
        stroke: stroke,
        weight: weight,
        opacity: opacity,
        color: color,
        fillOpacity: fillOpacity,
        fill: fill
    }
}

function regionsStyles() {
    return {
        color: 'gray',
        stroke: true,
        weight: 0.5
    }
}
function resetRegionStyle(vectorTileLayer, id) {
    vectorTileLayer.setFeatureStyle(id, regionsStyles())
}
document.addEventListener('DOMContentLoaded', async () => {
    let highlightedRegionId;
    let highlightedCountryId;
    let countryProperties;
    let tilesLoaded = false;
    let minTLayer;
    const toClosePopupOn = {};
    const activeLayers = {};
    L.DomEvent.fakeStop = function () {
        return true; /// magical thing
    }

    let properties = {};
    const isRegion = (layer) => {
        return ((layer.geounit && layer.geounit != layer.name_ru) || layer.type)
    }
    function countriesAndRegionsPopup(e, type) {
        const temp = e.layer.properties.temp || '';
        const unitName = properties.name_ru || properties.geounit;
        const id = properties.id;
        if (toClosePopupOn[id]) {
            delete (toClosePopupOn[id]);
            return undefined;
        }
        let content;
        if (type === 'region') {
            const countryName = properties.geounit || e.layer.properties.ru_name || e.layer.properties.ADMIN;
            content = `<b>${unitName}</b><br><b>${countryName}</b>`;

        }
        else if (type === 'sovereign') {
            content = `<b>${unitName}</b>`;
        }
        if (temp) content += `<br>Среднегодовая температура: ${temp}°C<br>`
        else content += `<br>Данных о средней температуре нет</br>`;
        if (activeLayers['tMin']) {
            const minTemp = properties.DN;
            minTemp ? content += `Минимальная температура: ${minTemp}°C` : content += `Данных о минимальной температуре нет`;
        }
        return content;
    }
    function regionsPopup(e, type) {
        const id = properties.id;
        if (toClosePopupOn[id]) {
            delete (toClosePopupOn[id]);
            return undefined;
        }
        const unitName = properties.name_ru || properties.geounit;
        if (type === 'region') {
            const countryName = properties.geounit || e.layer.properties.ru_name;
            content = `<b>${unitName}</b><br><b>${countryName}</b>`;

        }
        else if (type === 'sovereign') {
            content = `<b>${unitName}</b>`;
        }
        if (activeLayers['tMin']) {
            e.layer.properties.DN ? content += `<br>Минимальная температура: ${e.layer.properties.DN}°C</br>` : content += `<br>Данных о минимальной температуре нет</br>`;
        }
        return content;
    }
    function countriesPopup(e, type) {
        let content;
        const countryName = e.layer.properties.ru_name || e.layer.properties.ADMIN;
        const temp = e.layer.properties.temp || '';
        content = `<b>${countryName}</b>`;
        temp ? content += `<br>Среднегодовая температура: ${temp}°C</br>` : content += `<br>Данных о среднегодовой температуре нет</br>`;
        if (activeLayers['tMin']) {
            const minTemp = properties.DN;
            minTemp ? content += `Минимальная температура: ${minTemp}°C` : content += `Данных о минимальной температуре нет`;
        }
        return content;
    }
    const bindPopup = (args) => {
        const { e, type } = args;
        let content;
        if (activeLayers['countries'] && activeLayers['regions']) content = countriesAndRegionsPopup(e, type);
        else if (activeLayers['countries'] && !activeLayers['regions']) content = countriesPopup(e, type);
        else if (activeLayers['regions'] && !activeLayers['countries']) content = regionsPopup(e, type);
        let popup;
        if (content) {
            popup = L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
            popup.getElement().style.zIndex = 1000;
        }
    }
    function isHigherThanFullHD() {
        return window.screen.width > 1920 || window.screen.height > 1080;
    }
    function updateActiveLayers(layer, flag = null) {
        map.closePopup();
        const layerName = typeof (layer) === 'object' ? layer[0] : layer;
        if (flag !== null) {
            activeLayers[layerName] = flag;
            return;
        }
        if (activeLayers[layerName]) activeLayers[layerName] = false;
        else activeLayers[layerName] = true;
    }
    function getFeatureById(id, vectorLayer) {
        for (const key in vectorLayer) {
            const tile = vectorLayer._vectorTiles[key];
            const features = tile._features;
            if (features[id]) return features[id].feature;
            return null;
        }
    }
    function initMinTempLayer(url = 't_min_2021_01') {
        minTLayer = L.vectorGrid.protobuf(
            `https://tileservergl-proxy.vercel.app/tiles/data/${url}/{z}/{x}/{y}.pbf`, {
            rendererFactory: L.canvas.tile,
            interactive: true,
            pane: 't_min',
            attribution: '© My Data',
            vectorTileLayerStyles: {
                t_min_2021_01: properties => {
                    return { stroke: false, weight: 0, fill: true, fillColor: getTemperatureColor(properties.DN), fillOpacity: 1 }
                },
                t_min_2021_06: properties => {
                    return { stroke: false, fill: true, fillColor: getTemperatureColor(properties.DN), fillOpacity: 1 }
                },
                t_min_2021_12: properties => {
                    return { stroke: false, fill: true, fillColor: getTemperatureColor(properties.DN), fillOpacity: 1 }
                }
            },
        });
        updateActiveLayers('tMin', false);
    }
    createSpinner(document.getElementById('map-container'));
    const mapZIndex = document.getElementById('map').style.zIndex || 2;
    lowerOrRiseMap();
    const map = L.map('map', {
        worldCopyJump: false,
        maxBounds: [
            [-90, -180],
            [90, 180]
        ],
        minZoom: mobileCheck() ? 1 : isHigherThanFullHD() ? 4 : 3,
        maxZoom: 10,
        maxBoundsViscosity: 1.0
    }).setView([20, 0], mobileCheck() ? 1 : isHigherThanFullHD() ? 4 : 3);
    map.createPane('regions');
    map.getPane('regions').style.zIndex = 450;
    map.createPane('t_min');
    map.getPane('t_min').style.zIndex = 449;
    map.createPane('countries');
    const paneCol = document.getElementsByClassName('leaflet-popup-pane')
    let paneToChange = paneCol[0];
    paneToChange.style.zIndex = 1000;
    map.doubleClickZoom.disable();
    const regionsLayer = L.vectorGrid.protobuf(
        'https://tileservergl-proxy.vercel.app/tiles/data/regions/{z}/{x}/{y}.pbf', {
        rendererFactory: L.canvas.tile,
        interactive: true,
        pane: 'regions',
        attribution: '© My Data',
        vectorTileLayerStyles: {
            regions: properties => {
                return regionsStyles();
            },
        },
        getFeatureId: function (f) {
            return f.properties.id;
        },
    }
    ).addTo(map);

    const countriesLayer = L.vectorGrid.protobuf(
        'https://tileservergl-proxy.vercel.app/tiles/data/countries/{z}/{x}/{y}.pbf', {
        rendererFactory: L.canvas.tile,
        interactive: true,
        pane: 'countries',
        attribution: '© My Data',
        vectorTileLayerStyles: {
            countries: properties => {
                const styles = countriesStyle(properties);
                return styles;
            },
        },
        getFeatureId: function (f) {
            return f.properties.ru_name || f.properties.ADMIN;
        },
    }
    ).addTo(map);
    initMinTempLayer();
    updateActiveLayers('regions');
    updateActiveLayers('countries');
    countriesLayer.on('add', function () {
        updateActiveLayers(Object.keys(this._dataLayerNames));
    });
    countriesLayer.on('remove', function () {
        updateActiveLayers(Object.keys(this._dataLayerNames));
    });
    regionsLayer.on('add', function () {
        updateActiveLayers(Object.keys(this._dataLayerNames));
    });
    regionsLayer.on('remove', function () {
        updateActiveLayers(Object.keys(this._dataLayerNames));
    });
    minTLayer.on('add', function (e) {
        updateActiveLayers('tMin', true);
        const monthSwitcher = L.DomUtil.create('select', 'month-switcher');
        monthSwitcher.style.margin = '5px';
        monthSwitcher.style.padding = '5px';
        monthSwitcher.innerHTML = `
    <option value="1">January</option>
    <option value="6">June</option>
    <option value="12">December</option>
`;
        const container = layerControl.getContainer();
        container.appendChild(monthSwitcher);

        L.DomEvent.on(monthSwitcher, 'change', function (e) {
            updateMinTLayer(e.target.value);
        });
    });
    minTLayer.on('remove', function () {
        updateActiveLayers('tMin', false);
        const container = layerControl.getContainer();
        const monthSwitcher = container.querySelector('.month-switcher');
        if (monthSwitcher) {
            container.removeChild(monthSwitcher);
        }

    });
    let totalTiles = 0;
    let loadedTiles = 0;
    countriesLayer.on('load', function () {
        showCurrentLocationMarker(map);
        removeSpinner();
        tilesLoaded = true;
        lowerOrRiseMap(mapZIndex);
    });
    countriesLayer.on('tileload', function () {
        loadedTiles++;
        if (!tilesLoaded) updateLoaderProgress();
    });
    function updateLoaderProgress() {
        if (totalTiles === 0) {
            totalTiles = Object.keys(countriesLayer._tiles).length;
        }
        const progress = Math.round((loadedTiles / totalTiles) * 100);
        document.querySelector('.sr-only').textContent = `Загрузка карты... ${progress}%`;
    }
    const myEventForwarder = new L.eventForwarder({
        source: [regionsLayer, minTLayer],
        map: map,
        target: countriesLayer,
        // events to forward
        events: {
            click: true,
            mousemove: false
        },
        throttleMs: 100,
        throttleOptions: {
            leading: true,
            trailing: false
        }
    });
    myEventForwarder.enable();

    regionsLayer.on('click', function (e) {
        const layerProperties = e.layer.properties;
        properties = {};
        Object.assign(properties, layerProperties);
        const id = e.target.options.getFeatureId(e.layer);
        let areaType = isRegion(properties) ? 'region' : 'sovereign';
        if (highlightedRegionId) {
            resetRegionStyle(regionsLayer, highlightedRegionId);
            if (highlightedRegionId === id) {
                toClosePopupOn[highlightedRegionId] = true;
                highlightedRegionId = null;
                return;
            }
            highlightedRegionId = null;

        }
        highlightedRegionId = id;
        regionsLayer.setFeatureStyle(id, {
            color: 'red'
        });
        if (!activeLayers['countries'] && !activeLayers['tMin']) {
            bindPopup({ e: e, type: areaType });
        }
        if (activeLayers['tMin'] && !activeLayers['countries']) properties.areaType = areaType;
    });
    countriesLayer.on('click', function (e) {
        const id = e.target.options.getFeatureId(e.layer);
        if (!activeLayers['tMin']) {
            if (highlightedCountryId) {
                if (highlightedCountryId !== id) {
                    countriesLayer.setFeatureStyle(highlightedCountryId, countriesStyle(countryProperties))
                    highlightedCountryId = null;
                }
            }
            countryProperties = Object.assign({}, e.layer.properties);
            if (highlightedCountryId !== id) {
                highlightedCountryId = e.target.options.getFeatureId(e.layer);
                const highlightedCountryStyles = { color: 'blue', weight: 2 };
                countriesLayer.setFeatureStyle(highlightedCountryId, countriesStyle(e.layer.properties, highlightedCountryStyles))
            }
        }


        let areaType;
        if (activeLayers['regions']) {
            if (isRegion(properties)) areaType = 'region'
            else areaType = 'sovereign';
        }
        bindPopup({ e: e, type: areaType })
    });
    minTLayer.on('click', function (e) {
        properties.DN = e.layer.properties.DN;
        if (!activeLayers['countries']) bindPopup({ e: e, type: properties.areaType });
    })
    const layerControl = L.control.layers({}, {
        'Regions': regionsLayer,
        'Countries': countriesLayer,
        'Min temperature': minTLayer
    }).addTo(map);


    function updateMinTLayer(month) {
        const url = `t_min_2021_${month.padStart(2, '0')}`;
        minTLayer.setUrl(`https://tileservergl-proxy.vercel.app/tiles/data/${url}/{z}/{x}/{y}.pbf`);
    }


})

