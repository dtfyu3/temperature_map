
function createSpinner(container) {
    const spinner_container = document.createElement("div");
    spinner_container.id = 'loading-spinner';
    const spinner = document.createElement("div");
    spinner.classList.add('spinner');
    spinner_container.appendChild(spinner);
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
// function downloadFile(data, fileName) {
//     const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `${fileName}.geojson`;
//     document.body.appendChild(a);
//     a.click();
//     document.body.removeChild(a);
//     URL.revokeObjectURL(url);
// }
function countriesStyle(properties, styles = {}) {
    const { color = 'black', weight = 1, opacity = 1, fillOpacity = 1, fill = true } = styles;
    const fillColor = getTemperatureColor(properties.temp);
    return {
        fillColor: fillColor,
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
    L.DomEvent.fakeStop = function () {
        return true; /// magical thing
    }

    let properties = {};
    const isRegion = (layer) => {
        return ((layer.geounit && layer.geounit != layer.name_ru) || layer.type)
    }

    const bindPopup = (args) => {
        const { e, type } = args;
        const temp = e.layer.properties.temp || '';
        const unitName = properties.name_ru || properties.geounit;
        let content;
        if (type === 'region') {
            const countryName = properties.geounit || e.layer.properties.ru_name || e.layer.properties.ADMIN;
            content = `<b>${unitName}</b><br><b>${countryName}</b>`;

        }
        else if (type === 'sovereign') {
            content = `<b>${unitName}</b>`;
        }
        if (temp) content += `:${temp}°C`
        else content += `<br>Данных о температуре нет`;
        L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
    }
    function isHigherThanFullHD(){
        return window.screen.width > 1920 || window.screen.height > 1080;
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
    map.createPane('countries');
    const regionsLayer = L.vectorGrid.protobuf(
        'https://tileserver-gl-latest-y8u4.onrender.com/data/regions/{z}/{x}/{y}.pbf', {
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
            return f.properties.name_ru;
        },
    }
    ).addTo(map);
    const countriesLayer = L.vectorGrid.protobuf(
        'https://tileserver-gl-latest-y8u4.onrender.com/data/countries/{z}/{x}/{y}.pbf', {
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
            return f.properties.ru_name;
        },
    }
    ).addTo(map);
    countriesLayer.on('tileload', function () {
        showCurrentLocationMarker(map);
        removeSpinner();
        lowerOrRiseMap(mapZIndex);
    })
    const myEventForwarder = new L.eventForwarder({
        source: regionsLayer,
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
        if (highlightedRegionId) {
            const style = regionsStyles();
            resetRegionStyle(regionsLayer, highlightedRegionId);
            highlightedRegionId = null;
        }

        highlightedRegionId = id;
        regionsLayer.setFeatureStyle(id, {
            color: 'red'
        })


    });
    countriesLayer.on('click', function (e) {
        if (highlightedCountryId) {
            countriesLayer.setFeatureStyle(highlightedCountryId, countriesStyle(countryProperties))
            highlightedCountryId = null;
        }
        countryProperties = Object.assign(e.layer.properties);
        highlightedCountryId = e.target.options.getFeatureId(e.layer);
        const highlightedCountryStyles = { color: 'blue', weight: 2 }; 
        countriesLayer.setFeatureStyle(highlightedCountryId, countriesStyle(e.layer.properties, highlightedCountryStyles))
        let areaType;
        if (isRegion(properties)) areaType = 'region'
        else areaType = 'sovereign';
        bindPopup({ e: e, type: areaType })


    });
})

