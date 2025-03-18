
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
function countriesStyle(properties) {
    const fillColor = getTemperatureColor(properties.temp);
    return {
        fillColor: fillColor,
        weight: 1,
        opacity: 1,
        color: 'gray',
        fillOpacity: 0.7,
        fill: true
    }
}



document.addEventListener('DOMContentLoaded', async () => {
    L.DomEvent.fakeStop = function () {
        return true;
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
        minZoom: mobileCheck() ? 1 : 3,
        maxZoom: 10,
        maxBoundsViscosity: 1.0
    }).setView([20, 0], mobileCheck() ? 1 : 3);
    map.createPane('regions');
    // map.getPane('regions').style.zIndex = 1000; // actually works
    map.createPane('countries');
    console.log(map.getPanes());
    const regionsLayer = L.vectorGrid.protobuf(
        'https://tileserver-gl-latest-y8u4.onrender.com/data/regions/{z}/{x}/{y}.pbf', {
        rendererFactory: L.canvas.tile,
        interactive: true,
        pane: 'regions',
        attribution: '© My Data',
        vectorTileLayerStyles: {
            regions: properties => {
                return {
                    color: 'gray',
                    stroke: true,
                    weight: '0.5'
                }
            },
            getFeatureId: function (f) {
                return f.properties.id;
            },
        }
    }
    ).addTo(map);
    const countriesLayer = L.vectorGrid.protobuf(
        'https://tileserver-gl-latest-y8u4.onrender.com//data/countries/{z}/{x}/{y}.pbf', {
        rendererFactory: L.canvas.tile,
        interactive: true,
        pane: 'countries',
        attribution: '© My Data',
        vectorTileLayerStyles: {
            countries: properties => {
                const styles = countriesStyle(properties);
                return styles;
            },
            getFeatureId: function (f) {
                return f.properties.id;
            },
        }
    }
    ).addTo(map);

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
    let properties = {

    }
    const isRegion = (layer) => {
        return ((layer.properties.geounit && layer.properties.geounit != layer.properties.name_ru) || layer.type)
    }
    const bindPopup = (args) => {
        const {e, type} = args;
        const temp = properties.temp || '';
        const unitName = e.layer.properties.name_ru;
        let content;
        if(type === 'region'){
            const countryName = e.layer.properties.geounit || properties.ru_name || properties.ADMIN;
            content = `<b>${unitName}</b><br><b>${countryName}</b>`;
           
        }
        else if (type === 'sovereign'){
            content = `<b>${unitName}</b>`;
        }
        if (temp) content += `:${temp}°C`
        else content += `<br>Данных о температуре нет`;
        L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
    }
    regionsLayer.on('click', function (e) {
        let type;
        if (isRegion) type = 'region'
        else type = 'sovereign';
        bindPopup({e:e,type:type})
    });
    countriesLayer.on('click', function (e) {
        const layerProperties = e.layer.properties;
        properties = {};
        Object.assign(properties, layerProperties);

    });
    showCurrentLocationMarker(map);
    removeSpinner();
    lowerOrRiseMap(mapZIndex);
})

