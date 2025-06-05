// Na górze app.js
var mapStyle = [
  {
    'featureType': 'administrative',
    'elementType': 'all',
    'stylers': [{ 'visibility': 'on' }, { 'lightness': 33 }],
  },
  {
    'featureType': 'landscape',
    'elementType': 'all',
    'stylers': [{ 'color': '#f0efe9' }],
  },
  {
    'featureType': 'poi.park',
    'elementType': 'geometry',
    'stylers': [{ 'color': '#e6ccff' }],
  },
  {
    'featureType': 'poi.park',
    'elementType': 'labels',
    'stylers': [{ 'visibility': 'on' }, { 'lightness': 20 }],
  },
  {
    'featureType': 'road',
    'elementType': 'all',
    'stylers': [{ 'lightness': 20 }],
  },
  {
    'featureType': 'road.highway',
    'elementType': 'geometry',
    'stylers': [{ 'color': '#c5c6c6' }],
  },
  {
    'featureType': 'road.arterial',
    'elementType': 'geometry',
    'stylers': [{ 'color': '#ff4d4d' }],
  },
  {
    'featureType': 'road.local',
    'elementType': 'geometry',
    'stylers': [{ 'color': '#89aaf1' }],
  },
  {
    'featureType': 'water',
    'elementType': 'all',
    'stylers': [{ 'visibility': 'on' }, { 'color': '#50b37b' }],
  }
];



// Funkcja inicjująca mapę i warstwy
function buildMap() {
  const map = new google.maps.Map(document.getElementById('map'), {
    zoom: 7,
    center: { lat: 52.632469, lng: -1.689423 },
    styles: mapStyle,
   // mapId: "5ab77652d0a310381d75b5fd",
  });

  // Load the stores GeoJSON onto the map.
  map.data.loadGeoJson('stores.json', { idPropertyName: 'storeid' });

  // Define the custom marker icons, using the store's "category".
  map.data.setStyle((feature) => {
    return {
      icon: {
        url: `img/icon_${feature.getProperty('category')}.png`,
        scaledSize: new google.maps.Size(64, 64),
      },
    };
  });

  const apiKey = 'AIzaSyBWNfzPMAPGy6zgSjc01QLsUtHgObh4LHI';
  const infoWindow = new google.maps.InfoWindow();

  // Show the information for a store when its marker is clicked.
  map.data.addListener('click', (event) => {
    const category = event.feature.getProperty('category');
    const name = event.feature.getProperty('name');
    const description = event.feature.getProperty('description');
    const hours = event.feature.getProperty('hours');
    const phone = event.feature.getProperty('phone');
    const position = event.feature.getGeometry().get();
    const content = `
      <img style="float:left; width:200px; margin-top:30px" src="img/logo_${category}.png">
      <div style="margin-left:220px; margin-bottom:20px;">
        <h2>${name}</h2><p>${description}</p>
        <p><b>Open:</b> ${hours}<br/><b>Phone:</b> ${phone}</p>
        <p><img src="https://maps.googleapis.com/maps/api/streetview?size=350x120&location=${position.lat()},${position.lng()}&key=${apiKey}&solution_channel=GMP_codelabs_simplestorelocator_v1_a"></p>
      </div>
    `;

    infoWindow.setContent(content);
    infoWindow.setPosition(position);
    infoWindow.setOptions({ pixelOffset: new google.maps.Size(0, -30) });
    infoWindow.open(map);
  });

  // Dodaj komponent Autocomplete
  buildPacComponent(map);
}

// Funkcja budująca komponent Autocomplete (search bar)
function buildPacComponent(map) {
  const card = document.createElement('div');
  const titleBar = document.createElement('div');
  const title = document.createElement('div');
  const container = document.createElement('div');
  const input = document.createElement('input');
  const options = {
    types: ['address'],
    componentRestrictions: { country: 'gb' },
  };

  card.setAttribute('id', 'pac-card');
  title.setAttribute('id', 'title');
  title.textContent = 'Find the nearest store';
  titleBar.appendChild(title);
  container.setAttribute('id', 'pac-container');
  input.setAttribute('id', 'pac-input');
  input.setAttribute('type', 'text');
  input.setAttribute('placeholder', 'Enter an address');
  container.appendChild(input);
  card.appendChild(titleBar);
  card.appendChild(container);
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);

  const autocomplete = new google.maps.places.Autocomplete(input, options);
  autocomplete.setFields(['address_components', 'geometry', 'name']);

  const originMarker = new google.maps.Marker({ map: map });
  originMarker.setVisible(false);
  let originLocation = map.getCenter();

  autocomplete.addListener('place_changed', async () => {
    originMarker.setVisible(false);
    originLocation = map.getCenter();
    const place = autocomplete.getPlace();

    if (!place.geometry) {
      window.alert('No address available for input: \'' + place.name + '\'');
      return;
    }

    originLocation = place.geometry.location;
    map.setCenter(originLocation);
    map.setZoom(9);

    originMarker.setPosition(originLocation);
    originMarker.setVisible(true);

    const rankedStores = await calculateDistances(map.data, originLocation);
    showStoresList(map.data, rankedStores);
  });
}

// Funkcja asynchroniczna do obliczania dystansów
async function calculateDistances(data, origin) {
  const stores = [];
  const destinations = [];

  // Build parallel arrays for the store IDs and destinations
  data.forEach((store) => {
    const storeNum = store.getProperty('storeid');
    const storeLoc = store.getGeometry().get();

    stores.push(storeNum);
    destinations.push(storeLoc);
  });

  // Retrieve the distances of each store from the origin
  // The returned list will be in the same order as the destinations list
  const service = new google.maps.DistanceMatrixService();
  const getDistanceMatrix =
    (service, parameters) => new Promise((resolve, reject) => {
      service.getDistanceMatrix(parameters, (response, status) => {
        if (status != google.maps.DistanceMatrixStatus.OK) {
          reject(response);
        } else {
          const distances = [];
          const results = response.rows[0].elements;
          for (let j = 0; j < results.length; j++) {
            const element = results[j];
            const distanceText = element.distance.text;
            const distanceVal = element.distance.value;
            const distanceObject = {
              storeid: stores[j],
              distanceText: distanceText,
              distanceVal: distanceVal,
            };
            distances.push(distanceObject);
          }

          resolve(distances);
        }
      });
    });

  const distancesList = await getDistanceMatrix(service, {
    origins: [origin],
    destinations: destinations,
    travelMode: 'DRIVING',
    unitSystem: google.maps.UnitSystem.METRIC,
  });

  distancesList.sort((first, second) => {
    return first.distanceVal - second.distanceVal;
  });

  return distancesList;
}

// Funkcja pokazująca listę sklepów (panel boczny)
function showStoresList(data, stores) {
  if (stores.length == 0) {
    console.log('empty stores');
    return;
  }

  let panel = document.createElement('div');
  // If the panel already exists, use it. Else, create it and add to the page.
  if (document.getElementById('panel')) {
    panel = document.getElementById('panel');
    // If panel is already open, close it
    if (panel.classList.contains('open')) {
      panel.classList.remove('open');
    }
  } else {
    panel.setAttribute('id', 'panel');
    const body = document.body;
    body.insertBefore(panel, body.childNodes[0]);
  }

  // Clear the previous details
  while (panel.lastChild) {
    panel.removeChild(panel.lastChild);
  }

  stores.forEach((store) => {
    // Add store details with text formatting
    const name = document.createElement('p');
    name.classList.add('place');
    const currentStore = data.getFeatureById(store.storeid);
    name.textContent = currentStore.getProperty('name');
    panel.appendChild(name);
    const distanceText = document.createElement('p');
    distanceText.classList.add('distanceText');
    distanceText.textContent = store.distanceText;
    panel.appendChild(distanceText);
  });

  // Open the panel
  panel.classList.add('open');

  return;
}

// Funkcja wywoływana przez Google Maps API (callback)
function initMap() {
  buildMap();
}