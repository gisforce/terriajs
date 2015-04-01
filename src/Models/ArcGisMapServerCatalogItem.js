'use strict';

/*global require,URI*/

var ArcGisMapServerImageryProvider = require('../../third_party/cesium/Source/Scene/ArcGisMapServerImageryProvider');
var Cartesian2 = require('../../third_party/cesium/Source/Core/Cartesian2');
var CesiumMath = require('../../third_party/cesium/Source/Core/Math');
var defined = require('../../third_party/cesium/Source/Core/defined');
var defineProperties = require('../../third_party/cesium/Source/Core/defineProperties');
var DeveloperError = require('../../third_party/cesium/Source/Core/DeveloperError');
var ImageryLayer = require('../../third_party/cesium/Source/Scene/ImageryLayer');
var knockout = require('../../third_party/cesium/Source/ThirdParty/knockout');
var Rectangle = require('../../third_party/cesium/Source/Core/Rectangle');
var WebMercatorProjection = require('../../third_party/cesium/Source/Core/WebMercatorProjection');
var WebMercatorTilingScheme = require('../../third_party/cesium/Source/Core/WebMercatorTilingScheme');
var when = require('../../third_party/cesium/Source/ThirdParty/when');

var CesiumTileLayer = require('../Map/CesiumTileLayer');
var ImageryLayerCatalogItem = require('./ImageryLayerCatalogItem');
var inherit = require('../Core/inherit');

/**
 * A {@link ImageryLayerCatalogItem} representing a layer from an Esri ArcGIS MapServer.
 *
 * @alias ArcGisMapServerCatalogItem
 * @constructor
 * @extends ImageryLayerCatalogItem
 * 
 * @param {Application} application The application.
 */
var ArcGisMapServerCatalogItem = function(application) {
    ImageryLayerCatalogItem.call(this, application);

    this._legendUrl = undefined;

    /**
     * Gets or sets the URL of the WMS server.  This property is observable.
     * @type {String}
     */
    this.url = '';

    /**
     * Gets or sets the comma-separated list of layer IDs to show.  If this property is undefined,
     * all layers are shown.
     * @type {String}
     */
    this.layers = undefined;

    knockout.track(this, ['url', 'layers', '_legendUrl']);

    // dataUrl, metadataUrl, and legendUrl are derived from url if not explicitly specified.
    delete this.__knockoutObservables.legendUrl;
    knockout.defineProperty(this, 'legendUrl', {
        get : function() {
            if (defined(this._legendUrl)) {
                return this._legendUrl;
            }
            return cleanUrl(this.url) + '/legend';
        },
        set : function(value) {
            this._legendUrl = value;
        }
    });

};

inherit(ImageryLayerCatalogItem, ArcGisMapServerCatalogItem);

defineProperties(ArcGisMapServerCatalogItem.prototype, {
    /**
     * Gets the type of data item represented by this instance.
     * @memberOf ArcGisMapServerCatalogItem.prototype
     * @type {String}
     */
    type : {
        get : function() {
            return 'esri-mapServer';
        }
    },

    /**
     * Gets a human-readable name for this type of data source, 'Esri ArcGIS MapServer'.
     * @memberOf ArcGisMapServerCatalogItem.prototype
     * @type {String}
     */
    typeName : {
        get : function() {
            return 'Esri ArcGIS MapServer';
        }
    }
});


ArcGisMapServerCatalogItem.prototype.pickFeaturesInLeaflet = function(mapExtent, mapWidth, mapHeight, pickX, pickY) {
    var projection = new WebMercatorProjection();
    var sw = projection.project(Rectangle.southwest(mapExtent));
    var ne = projection.project(Rectangle.northeast(mapExtent));

    var tilingScheme = new WebMercatorTilingScheme({
        rectangleSouthwestInMeters: sw,
        rectangleNortheastInMeters: ne
    });

    // Compute the longitude and latitude of the pick location.
    var x = CesiumMath.lerp(sw.x, ne.x, pickX / (mapWidth - 1));
    var y = CesiumMath.lerp(ne.y, sw.y, pickY / (mapHeight - 1));

    var ll = projection.unproject(new Cartesian2(x, y));

    // Use a Cesium imagery provider to pick features.
    var imageryProvider = new ArcGisMapServerImageryProvider({
        url : cleanAndProxyUrl(this.application, this.url),
        layers : this.layers,
        tilingScheme : tilingScheme,
        tileWidth : mapWidth,
        tileHeight : mapHeight,
        usePreCachedTilesIfAvailable : false
    });

    var deferred = when.defer();

    function pollForReady() {
        if (imageryProvider.ready) {
            deferred.resolve(imageryProvider.pickFeatures(0, 0, 0, ll.longitude, ll.latitude));
        } else {
            setTimeout(pollForReady, 100);
        }
    }

    pollForReady();

    return deferred.promise;
};

ArcGisMapServerCatalogItem.prototype._createImageryProvider = function() {
    return new ArcGisMapServerImageryProvider({
        url : cleanAndProxyUrl(this.application, this.url),
        layers : this.layers,
        tilingScheme : new WebMercatorTilingScheme()
    });
}

function cleanAndProxyUrl(application, url) {
    return proxyUrl(application, cleanUrl(url));
}

function cleanUrl(url) {
    // Strip off the search portion of the URL
    var uri = new URI(url);
    uri.search('');
    return uri.toString();
}

function proxyUrl(application, url) {
    if (defined(application.corsProxy) && application.corsProxy.shouldUseProxy(url)) {
        return application.corsProxy.getURL(url);
    }

    return url;
}

module.exports = ArcGisMapServerCatalogItem;
