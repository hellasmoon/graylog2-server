import React, { PropTypes } from 'react';
import $ from 'jquery';
import d3 from 'd3';
import dc from 'dc';
import numeral from 'numeral';

import SourceTitle from './SourceTitle';
import UniversalSearch from 'logic/search/UniversalSearch';
import StringUtils from 'util/StringUtils';
import { Select } from 'components/common';

import StoreProvider from 'injection/StoreProvider';
const SearchStore = StoreProvider.getStore('Search');
import Routes from 'routing/Routes';
import history from 'util/History';
import Immutable from 'immutable';
import Qs from 'qs';
import DateTime from 'logic/datetimes/DateTime';

const SourceDataTable = React.createClass({
  propTypes: {
    numberOfTopValues: PropTypes.number.isRequired,
    resetFilters: PropTypes.func.isRequired,
    setSearchFilter: PropTypes.func.isRequired,
    streams: React.PropTypes.arrayOf(React.PropTypes.object),
    selected: React.PropTypes.string,
    range: PropTypes.number.isRequired,
    resolution: React.PropTypes.string.isRequired,
  },

  getInitialState() {
    return {
      numberOfSources: 100,
    };
  },

  _getAddToSearchButton(source) {
    const addToSearchButton = document.createElement('button');
    addToSearchButton.className = 'btn btn-xs btn-default dc-search-button';
    if (this.props.selected){
      addToSearchButton.title = 'Add to search query';
    }else {
      addToSearchButton.title = 'Search log in this group';
    }
    addToSearchButton.setAttribute('data-source', StringUtils.unescapeHTML(source));
    addToSearchButton.innerHTML = "<i class='fa fa-search-plus'></i>";

    return addToSearchButton.outerHTML;
  },

  renderDataTable(dimension, group, onDataFiltered) {
    const dataTableDomNode = $('#dc-sources-result')[0];
    this._dataTable = dc.dataTable(dataTableDomNode);
    this._dataTable
      .dimension(dimension)
      .group((d) => {
        const topValues = group.top(this.props.numberOfTopValues);
        const dInTopValues = topValues.some(value => d.name.localeCompare(value.key) === 0);
        return (dInTopValues ? 'Top sources' : 'Others');
      })
      .size(this.state.numberOfSources)
      .columns([
        d => `<a href="javascript:undefined" class="dc-filter-link" title="Filter this source">${d.name}</a>`,
        d => `${d.percentage.toFixed(2)}%`,
        d => numeral(d.message_count).format('0,0'),
        d => this._getAddToSearchButton(d.name),
      ])
      .sortBy(d => d.message_count)
      .order(d3.descending)
      .on('renderlet', (table) => {
        table.selectAll('.dc-table-group').classed('info', true);
        this._addSourceToSearchBarListener(table);
        this._filterSourceListener(table, onDataFiltered);
      });
  },

  _addSourceToSearchBarListener(table) {
    table.selectAll('td.dc-table-column .dc-search-button').on('click', () => {
      const source = $(d3.event.target).closest('button').data('source');
      const params = SearchStore.getParams();
      const selected = this.props.selected;
      const streams = this.props.streams;

      if (params.rangeType === 'absolute') {
        const fromInput = params.rangeParams.get('from');
        const toInput = params.rangeParams.get('to');

        params.rangeParams.set('from',DateTime.parseFromString(fromInput).toISOString());
        params.rangeParams.set('to',DateTime.parseFromString(toInput).toISOString());
      }

      var searchParams = Immutable.Map();
      searchParams = searchParams.set('rangetype', params.rangeType);
      searchParams = searchParams.merge(params.rangeParams);
      searchParams = searchParams.set('q', params.query);


      const queryString = Qs.stringify(searchParams.toJS());


      if (streams){
        if (selected){
          SearchStore.addSearchTerm('HOSTIP', source, UniversalSearch.orOperator());
        }else {
          streams.map((stream) => {
            if (stream.title.indexOf("_Group:") >= 0){
              if (stream.title.substr(7) == source){
                history.push(Routes.stream_search(stream.id)+"?"+queryString);
              }
            }
          });
        }
      }
    });
  },

  _filterSourceListener(table, onDataFiltered) {
    table.selectAll('td.dc-table-column a.dc-filter-link').on('click', () => {
      const parentTdElement = $(d3.event.target).parents('td.dc-table-column._0');
      const datum = d3.selectAll(parentTdElement).datum();

      onDataFiltered(datum.name);
    });
  },

  redraw() {
    this._dataTable.redraw();
  },

  clearFilters() {
    this._dataTable.filterAll();
  },

  getFilters() {
    return (this._dataTable ? this._dataTable.filters() : []);
  },

  setFilter(filter) {
    this._dataTable.filter(filter);
  },

  changeNumberOfSources(numberOfSources) {
    this._dataTable
      .size(numberOfSources)
      .redraw();
  },

  _onNumberOfSourcesChanged(event) {
    this.setState({ numberOfSources: event.target.value }, () => {
      this.changeNumberOfSources(this.state.numberOfSources);
    });
  },

  _onFilterChanged(event) {
    this.props.setSearchFilter(event.target.value);
  },

  render() {
    const resultTable = (
      <table id="dc-sources-result" className="sources table table-hover">
        <thead>
          <tr>
            <th style={{ width: '60%' }}>Name</th>
            <th>Percentage</th>
            <th>Message count</th>
            <th style={{ width: 10 }} />
          </tr>
        </thead>
      </table>
    );

    return (
      <div>
        <SourceTitle resetFilterId="dc-sources-result-reset" resetFilters={this.props.resetFilters}>
          Selected sources
        </SourceTitle>
        <div className="row sources-filtering">
          <div className="col-md-6">
            <div className="form-inline">
              <div className="form-group">
                <input type="text" className="form-control input-sm" onChange={this._onFilterChanged}
                       placeholder="Search" />
              </div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="form-inline text-right">
              <div className="form-group">
                <label htmlFor="no-results">Show:</label>
                <select id="no-results" className="form-control input-sm" onChange={this._onNumberOfSourcesChanged}
                        value={this.state.numberOfSources}>
                  <option value="10">10</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="500">500</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        {resultTable}
      </div>
    );
  },
});

export default SourceDataTable;
