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
    const fromTime = moment.unix(this.props.timestamp - Number(range)).toISOString();
    const toTime = moment.unix(this.props.timestamp + Number(range)).toISOString();

    if (type == "group"){
      const group = [];
      const streamsInter = this.props.messageFields.streams;
      let streams = this.props.allStreams.filter((stream) => {
        if(streamsInter.indexOf(stream.id) > 0){
          return stream;
        }
      });
      streams = streams.filter((stream) => {
        if (stream.title.startsWith("_Group:")){
          return stream;
        }
      });
      streams.map((stream) => {
        stream.rules.map((rule) => {
          group.push(rule.value);
        })
      });
      if (streams.length > 0){
        return SearchStore.searchSurroundingMessagesByGroup(this.props.id, fromTime, toTime, group);
      }else{
        const fields = {};
        fields["HOSTIP"] = this.props.messageFields["HOSTIP"];
        return SearchStore.searchSurroundingMessages(this.props.id, fromTime, toTime, fields);
      }
    }else if (type == "ip"){
      const fields = {};
      fields["HOSTIP"] = this.props.messageFields["HOSTIP"];
      return SearchStore.searchSurroundingMessages(this.props.id, fromTime, toTime, fields);
    }else {
      return SearchStore.searchSurroundingMessages(this.props.id, fromTime, toTime, this._buildFilterFields());
    }

  },

  _clickItemCallback(name){
    let i = name.indexOf("|");
    const key = name.substr(0,i);
    i++;
    const type = name.substr(i);

    const searchLink = this._searchLinkByType(key, type);
    console.log(searchLink);
    history.push(searchLink);

  },

  render() {
    const timeRangeOptions = this._buildTimeRangeOptions(this.props.searchConfig);
    const menuItems = Object.keys(timeRangeOptions)
      .sort((a, b) => naturalSort(a, b))
      .map((key, idx) => {
        return (
          <MenuItem key={idx} href={this._searchLink(key)}>{timeRangeOptions[key]}</MenuItem>
        );
      });
    {/*<DropdownButton title="Show surrounding messages" bsSize="small" id="surrounding-search-dropdown">*/}
    {/*{menuItems}*/}
    {/*</DropdownButton>*/}

    const menu = Object.keys(timeRangeOptions)
      .sort((a, b) => naturalSort(a, b))
      .map((key, idx) => {
        return (
          {
            text: timeRangeOptions[key],
            name: timeRangeOptions[key],
            items: [
              {
                name: key+"|"+"group",
                text: "search by Group"
              },
              {
                name: key+"|"+"ip",
                text: "search by IP"
              }
            ]
          }
        );
      });

    return (
      <DropdownButton title="Show surrounding messages" bsSize="small" id="surrounding-search-dropdown">
        <li style={{display:"block"}}>
          <MenuList
            listClass="context-menu"
            itemClass="context-menu-item"
            triangleClassName="context-menu-item-triangle"
            position={{ top: "100%", left: "10%" }}
            clickItemCallback={this._clickItemCallback}
            show
            items={menu}
          />
        </li>
      </DropdownButton>
    );
  },
});

export default SurroundingSearchButton;
