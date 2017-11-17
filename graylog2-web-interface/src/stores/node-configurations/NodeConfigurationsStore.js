import Reflux from 'reflux';

import Store from 'logic/local-storage/Store';
import URLUtils from 'util/URLUtils';
import ApiRoutes from 'routing/ApiRoutes';
import { Builder } from 'logic/rest/FetchProvider';

import ActionsProvider from 'injection/ActionsProvider';
const NodeConfigurationsActions = ActionsProvider.getActions('NodeConfigurations');

const NodeConfigurationsStore = Reflux.createStore({
  listenables: [NodeConfigurationsActions],
  sourceUrl: '/system/configuration',
  configuration: undefined,
  enableUC:false,

  getInitialState() {
    return this.list();
  },

  getConfigInfo(){
    return { configuration: this.configuration, enableUC: this.enableUC };
  },

  list(){
    const builder = new Builder('GET', URLUtils.qualifyUrl(this.sourceUrl));
    const promise = builder.build()
      .then((configuration) => {
        this.trigger({configuration: configuration.body});
      });
    NodeConfigurationsActions.list.promise(promise);
  },
});

export default NodeConfigurationsStore;
