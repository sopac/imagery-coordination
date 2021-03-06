/* eslint no-return-assign: 0 */
'use strict';
import React, { PropTypes as T } from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import mapboxgl from 'mapbox-gl';
import Draw from '@mapbox/mapbox-gl-draw';
import StaticMode from '@mapbox/mapbox-gl-draw-static-mode';
import Measure from 'react-measure';
import { diff } from 'mapbox-gl-style-spec';
import StyleSwitcher from './style-switcher';
import { addMapControls, addGeocoder, disableGeocoder, enableGeocoder }
  from '../utils/map';
import { mbStyles } from '../utils/mapbox-styles';
import { setMapLocation, setMapSize, setTaskGeoJSON,
  setDrawMode, setSelectedFeatureId } from '../actions/map-actions';
import { setMapBaseLayer } from '../actions';
import { simpleSelect, directSelect, drawPolygon, staticDraw } from
  '../utils/constants';

export const EditMap = React.createClass({
  displayName: 'EditMap',

  propTypes: {
    style: T.object.isRequired,
    taskGeojson: T.object,
    drawMode: T.string,
    selectedFeatureId: T.string,
    setMapLocation: T.func.isRequired,
    setMapSize: T.func.isRequired,
    setTaskGeoJSON: T.func.isRequired,
    setDrawMode: T.func.isRequired,
    setSelectedFeatureId: T.func.isRequired,
    mapId: T.string,
    className: T.string,
    baseLayers: T.array.isRequired,
    baseLayer: T.shape({
      id: T.string.isRequired,
      name: T.string.isRequired
    }).isRequired,
    setMapBaseLayer: T.func.isRequired
  },

  componentDidMount: function () {
    this.map = new mapboxgl.Map({
      container: this.mapDiv,
      style: this.props.style
    });
    addMapControls(this.map, ReactDOM.findDOMNode(this));
    this.addDraw();
    addGeocoder(this.map);
  },

  componentWillUnmount: function () {
    this.map.remove();
  },

  componentWillReceiveProps: function (nextProps) {
    this.manageFeatures = (event) => {
      this.removeFeature(nextProps.taskGeojson, nextProps.drawMode);
      enableGeocoder(ReactDOM.findDOMNode(this));
      if (nextProps.taskGeojson) {
        this.addFeature(nextProps.taskGeojson, nextProps.drawMode,
                        nextProps.selectedFeatureId);
        disableGeocoder(ReactDOM.findDOMNode(this));
      }
      if (nextProps.drawMode === drawPolygon) {
        disableGeocoder(ReactDOM.findDOMNode(this));
      }
    };
    if (this.map.loaded()) {
      this.map.off('load', this.manageFeatures);
      this.manageFeatures();
    } else {
      this.map.on('load', this.manageFeatures);
    }
    // Unfortunately ordering is important here.  Map changes must be applied
    // after features are updated.
    const changes = diff(this.props.style, nextProps.style);
    changes.forEach(change => {
      this.map[change.command].apply(this.map, change.args);
    });
  },

  addFeature: function (feature, mode, selectedFeatureId) {
    this.draw.add(feature);
    if (mode) {
      if (mode === 'direct_select' && selectedFeatureId) {
        this.draw.changeMode(mode, { featureId: selectedFeatureId });
      }
      if (mode === simpleSelect && selectedFeatureId) {
        this.draw.changeMode(mode, { featureIds: [selectedFeatureId] });
      }
      if (mode === simpleSelect && !selectedFeatureId) {
        this.draw.changeMode(mode);
      }
      if (mode === drawPolygon && selectedFeatureId) {
        this.draw.changeMode(directSelect, { featureId: selectedFeatureId });
      }
    }
  },

  removeFeature: function (feature, mode) {
    if (!feature) {
      this.draw.deleteAll();
      this.draw.changeMode(mode);
    }
  },

  addDraw: function () {
    const modes = Draw.modes;
    modes.static = StaticMode;
    this.draw = new Draw({
      displayControlsDefault: false,
      styles: mbStyles,
      defaultMode: staticDraw,
      modes: modes
    });
    this.map.addControl(this.draw);
    this.map.on('draw.update', (event) => {
      this.props.setTaskGeoJSON(Object.assign({}, event.features[0]));
    });
    this.map.on('draw.modechange', (event) => {
      const currentMode = this.draw.getMode();
      if (currentMode !== this.props.drawMode) {
        this.props.setDrawMode(event.mode);
      }
    });
    this.map.on('draw.create', (event) => {
      this.props.setTaskGeoJSON(Object.assign({}, event.features[0])
      );
    });
    this.map.on('draw.selectionchange', (event) => {
      if (this.props.drawMode === 'simple_select' && event.features.length === 0 &&
         this.props.selectedFeatureId) {
        this.props.setSelectedFeatureId(undefined);
      }
      if (this.props.drawMode === 'simple_select' && event.features.length > 0 &&
          !this.props.selectedFeatureId) {
        this.props.setSelectedFeatureId(event.features[0].id);
      }
    });
  },

  render: function () {
    return (
      <Measure onResize={(contentRect) => {
        this.props.setMapSize(contentRect.entry);
      }}>
      {({ measureRef }) =>
        <div
          ref={measureRef}
          className={this.props.className}>
          <div
            id={this.props.mapId}
            ref={(mapDiv) => {
              this.mapDiv = mapDiv;
            }}/>
          <div className='map-layers'>
            <StyleSwitcher
              baseLayer={this.props.baseLayer}
              baseLayers={this.props.baseLayers}
              setMapBaseLayer={this.props.setMapBaseLayer}
            />
          </div>
          </div>
      }
      </Measure>
    );
  }
});

function mapStateToProps (state) {
  return {
    taskGeojson: state.map.taskGeojson,
    style: state.map.style,
    drawMode: state.map.drawMode,
    selectedFeatureId: state.map.selectedFeatureId,
    baseLayer: state.map.baseLayer,
    baseLayers: state.map.baseLayers
  };
}

function mapDispatchToProps (dispatch) {
  return {
    setMapLocation: (location) => dispatch(setMapLocation(location)),
    setMapSize: (size) => dispatch(setMapSize(size)),
    setTaskGeoJSON: (taskGeojson) => dispatch(setTaskGeoJSON(taskGeojson)),
    setDrawMode: (drawMode) => dispatch(setDrawMode(drawMode)),
    setSelectedFeatureId: (id) => dispatch(setSelectedFeatureId(id)),
    setMapBaseLayer: (layer) => dispatch(setMapBaseLayer(layer))
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(EditMap);
