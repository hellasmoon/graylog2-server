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

import cookie from 'react-cookies'

import $ from 'jquery';

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

  _getQueryString(name) {
    let reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
    let r = window.location.search.substr(1).match(reg);
    if (r !== null) return unescape(r[2]);
    return null;
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
        if (!ucAddress){
          window.alert("[WARN] uc enabled but the address of uc is not defined! Please check the config file.");
        }
        let ticket;
        let ticketInCookie = true;
        ticket = cookie.load('ticket');
        if (!ticket){
          ticketInCookie = false;
          ticket = this._getQueryString('ticket');
        }
        if (!ticket){
          const uc = ucAddress.substr(0,ucAddress.indexOf("/hmac"))+"/hmac/";
          const redirectUri = window.location.href;//TODO: 判断这里如果已经有ticket怎么办
          window.location.href = uc + "login?redirect_uri="+redirectUri+"&current_application_key="+config.uc_application_key;
          return <LoadingPage text="Wating for uc login..." />;
        }
        if (!ticketInCookie){
          cookie.save('ticket', ticket, { path: '/' });
        }
        const queryUrl = ucAddress + "query";
        let querySuccess = true;
        $.ajax({
          async: false,
          url: queryUrl,
          data: {ticket:ticket, applicationKey:config.uc_application_key},
          success: (resp) => {
            console.log(resp);
            if (resp.success){
              const data =  eval('(' + resp.data + ')');
              console.log(data);

            }else {
              console.log("session timeout");
              cookie.remove("ticket", { path: '/' });
            }
          },
          error: (info) => {
            querySuccess = false;
          }
        });
        if (!querySuccess){
          const uc = ucAddress.substr(0,ucAddress.indexOf("/hmac"));
          const info = "UC SERVER ERROR! Cannot connect UC server with url: "+ uc + ", and Application key: " + config.uc_application_key;
          return <LoadingPage text={info} />;
        }
        return <LoadingPage text="We are preparing Graylog for you..." />;
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
