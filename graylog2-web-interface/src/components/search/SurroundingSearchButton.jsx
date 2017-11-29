import React from 'react';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import naturalSort from 'javascript-natural-sort';
import MenuList from '@ezetech/react-multi-level-menu-component';

import StoreProvider from 'injection/StoreProvider';
const SearchStore = StoreProvider.getStore('Search');

import moment from 'moment';

import history from 'util/History';

const SurroundingSearchButton = React.createClass({
  propTypes: {
    id: React.PropTypes.string.isRequired,
    timestamp: React.PropTypes.number.isRequired,
    searchConfig: React.PropTypes.object.isRequired,
    allStreams: React.PropTypes.object,
    messageFields: React.PropTypes.object.isRequired,
  },

  getInitialState() {
    return {
      menuShown: false
    };
  },

  _buildTimeRangeOptions(searchConfig) {
    const options = {};

    Object.keys(searchConfig.surrounding_timerange_options).forEach((key) => {
      options[moment.duration(key).asSeconds()] = searchConfig.surrounding_timerange_options[key];
    });

    return options;
  },

  _buildFilterFields() {
    const fields = {};

    if (this.props.searchConfig) {
      this.props.searchConfig.surrounding_filter_fields.forEach((field) => {
        fields[field] = this.props.messageFields[field];
      });
    }

    return fields;
  },

  _searchLink(range) {
    const fromTime = moment.unix(this.props.timestamp - Number(range)).toISOString();
    const toTime = moment.unix(this.props.timestamp + Number(range)).toISOString();

    return SearchStore.searchSurroundingMessages(this.props.id, fromTime, toTime, this._buildFilterFields());
  },

  _searchLinkByType(range, type){
    if (type == "group" || type == "ip"){
      const index = range.indexOf("|");
      const groupId = range.substr(index+1);
      const timeRange = range.substr(0,index);
      const fromTime = moment.unix(this.props.timestamp - Number(timeRange)).toISOString();
      const toTime = moment.unix(this.props.timestamp + Number(timeRange)).toISOString();
      return SearchStore.searchSurroundingMessagesByGroup(this.props.id, fromTime, toTime, groupId);
    }else {
      const fromTime = moment.unix(this.props.timestamp - Number(range)).toISOString();
      const toTime = moment.unix(this.props.timestamp + Number(range)).toISOString();
      return SearchStore.searchSurroundingMessages(this.props.id, fromTime, toTime, this._buildFilterFields());
    }
  },

  _clickItemCallback(name){
    let i = name.lastIndexOf("|");
    const key = name.substr(0,i);
    i++;
    const type = name.substr(i);

    const searchLink = this._searchLinkByType(key, type);
    console.log(searchLink);
    history.push(searchLink);
  },

  _toggleMenu() {
    this.setState({menuShown: !this.state.menuShown});
  },

  _closeMenu(e){
    e.preventDefault();
    this.setState({menuShown: false});
  },

  _getGroupItem(key){
    const group = [];
    const streamsInter = this.props.messageFields.streams;
    let streams = this.props.allStreams.filter((stream) => {
      if(streamsInter.indexOf(stream.id) >= 0){
        return stream;
      }
    });
    streams = streams.filter((stream) => {
      if (stream.title.startsWith("_Group:")){
        return stream;
      }
    });
    if (streams.size > 0){
      let groupItem = [];
      streams.map((stream) => {
        groupItem.push({name: key+"|"+stream.id+"|group", text: stream.title.substr(7)});
      });
      return groupItem;
    }else {
      return null;
    }

  },

  _getIPItem(key){
    const streamsInter = this.props.messageFields.streams;
    console.log(streamsInter);
    let streams = this.props.allStreams.filter((stream) => {
      if(streamsInter.indexOf(stream.id) >= 0){
        return stream;
      }
    });
    streams = streams.filter((stream) => {
      if (stream.title.startsWith("_IP:")){
        return stream;
      }
    });
    if (streams.size > 0){
      return {name: key+"|"+streams.get(0).id+"|ip", text: "search by IP"};
    }else {
      return null;
    }
  },


  render() {

    const timeRangeOptions = this._buildTimeRangeOptions(this.props.searchConfig);
    const menu = Object.keys(timeRangeOptions)
      .sort((a, b) => naturalSort(a, b))
      .map((key, idx) => {
        const groupItem = this._getGroupItem(key);
        const ipItem = this._getIPItem(key);
        if (groupItem != null && ipItem != null){
          return (
            {
              text: timeRangeOptions[key],
              name: timeRangeOptions[key],
              items: [
                {
                  name: key+"|"+"group",
                  text: "search by Group",
                  items: groupItem
                },
                ipItem,
                {
                  name: key+"|"+"origin",
                  text: "search by source"
                }
              ]
            }
          );
        }else if(groupItem == null && ipItem != null){
          return (
            {
              text: timeRangeOptions[key],
              name: timeRangeOptions[key],
              items: [
                ipItem,
                {
                  name: key+"|"+"origin",
                  text: "search by source"
                }
              ]
            }
          );
        }else if (groupItem != null && ipItem == null){
          return (
            {
              text: timeRangeOptions[key],
              name: timeRangeOptions[key],
              items: [
                {
                  name: key+"|"+"group",
                  text: "search by Group",
                  items: groupItem
                },
                {
                  name: key+"|"+"origin",
                  text: "search by source"
                }
              ]
            }
          );
        }else {
          return (
            {
              text: timeRangeOptions[key],
              name: timeRangeOptions[key],
              items: [
                {
                  name: key+"|"+"origin",
                  text: "search by source"
                }
              ]
            }
          );
        }
      });

    return (
      <div className="dropdown btn-group btn-group-sm" onMouseLeave={this._closeMenu}>
        <button className="btn btn-default dropdown-toggle" type="button" onClick={this._toggleMenu}>
          show surrounding message
          <span className="caret">&nbsp;</span>
        </button>

        <MenuList
          listClass="context-menu"
          itemClass="context-menu-item"
          triangleClassName="context-menu-item-triangle"
          clickItemCallback={this._clickItemCallback}
          show={this.state.menuShown}
          items={menu}
        />
      </div>
    );
  },
});

export default SurroundingSearchButton;
