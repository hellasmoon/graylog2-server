import React from 'react';
import Reflux from 'reflux';
import LoginPage from 'react-proxy?name=LoginPage!pages/LoginPage';
import LoadingPage from 'react-proxy?name=LoadingPage!pages/LoadingPage';
import LoggedInPage from 'react-proxy?name=LoggedInPage!pages/LoggedInPage';
import ServerUnavailablePage from 'pages/ServerUnavailablePage';

import StoreProvider from 'injection/StoreProvider';
const SessionStore = StoreProvider.getStore('Session');
const ServerAvailabilityStore = StoreProvider.getStore('ServerAvailability');
const CurrentUserStore = StoreProvider.getStore('CurrentUser');
const NodeConfigurationsStore = StoreProvider.getStore('NodeConfigurations');

import 'bootstrap/less/bootstrap.less';
import 'font-awesome/css/font-awesome.css';
import 'opensans-npm-webfont';
import 'stylesheets/bootstrap-submenus.less';
import 'toastr/toastr.less';
import 'rickshaw/rickshaw.css';
import 'stylesheets/graylog2.less';

const AppFacade = React.createClass({
  mixins: [Reflux.connect(NodeConfigurationsStore), Reflux.connect(SessionStore), Reflux.connect(ServerAvailabilityStore), Reflux.connect(CurrentUserStore)],

  componentDidMount() {
    this.interval = setInterval(ServerAvailabilityStore.ping, 20000);
  },

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  },

  render() {
    const config = this.state.configuration;

    if (!this.state.server.up) {
      return <ServerUnavailablePage server={this.state.server} />;
    }

    if (!config){
      return <LoadingPage text="We are preparing Graylog for you..." />;
    }

    if (!this.state.sessionId) {
      if(config.enable_uc){
        const ucAddress = config.uc_address;
        console.log(ucAddress);
      }
      return <LoginPage />;
    }
    if (!this.state.currentUser) {
      return <LoadingPage text="We are preparing Graylog for you..." />;
    }
    return <LoggedInPage />;
  },
});

export default AppFacade;
