/**
 * This file is part of Graylog.
 *
 * Graylog is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Graylog is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Graylog.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.graylog2.periodical;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.joschi.jadconfig.util.Duration;
import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Lists;
import com.google.common.net.HttpHeaders;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.bson.types.ObjectId;
import org.graylog2.Configuration;
import org.graylog2.appcenter.AppCenterData;
import org.graylog2.appcenter.AppCenterDataSyncResponse;
import org.graylog2.database.NotFoundException;
import org.graylog2.indexer.IndexSet;
import org.graylog2.indexer.IndexSetRegistry;
import org.graylog2.notifications.Notification;
import org.graylog2.notifications.NotificationService;
import org.graylog2.plugin.Tools;
import org.graylog2.plugin.database.ValidationException;
import org.graylog2.plugin.periodical.Periodical;
import org.graylog2.plugin.streams.Stream;
import org.graylog2.plugin.streams.StreamRule;
import org.graylog2.plugin.streams.StreamRuleType;
import org.graylog2.shared.users.Role;
import org.graylog2.streams.StreamImpl;
import org.graylog2.streams.StreamRuleImpl;
import org.graylog2.streams.StreamRuleService;
import org.graylog2.streams.StreamService;
import org.graylog2.users.RoleService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Inject;

import java.io.IOException;
import java.util.*;

import static java.util.concurrent.TimeUnit.HOURS;
import static java.util.concurrent.TimeUnit.MINUTES;

/**
 * Created by gengxiaotian on 2017/11/29.
 */
public class AppCenterSyncPeriodical extends Periodical {
    private static final Logger LOG = LoggerFactory.getLogger(AppCenterSyncPeriodical.class);
    private static final String USER_AGENT = String.format(Locale.CHINA, "jdjr-log-server (%s, %s, %s, %s)",
            System.getProperty("java.vendor"), System.getProperty("java.version"),
            System.getProperty("os.name"), System.getProperty("os.version"));

    private final Configuration configuration;
    private final ObjectMapper objectMapper;
    private final OkHttpClient httpClient;
    private final NotificationService notificationService;
    private final StreamService streamService;
    private final RoleService roleService;
    private final StreamRuleService streamRuleService;
    private final IndexSetRegistry indexSetRegistry;

    @Inject
    AppCenterSyncPeriodical(Configuration configuration,
                            ObjectMapper objectMapper,
                            OkHttpClient httpClient,
                            NotificationService notificationService,
                            StreamService streamService,
                            RoleService roleService,
                            StreamRuleService streamRuleService,
                            IndexSetRegistry indexSetRegistry){
        this.configuration = configuration;
        this.objectMapper = objectMapper;
        this.httpClient = httpClient;
        this.notificationService = notificationService;
        this.streamService = streamService;
        this.roleService = roleService;
        this.streamRuleService = streamRuleService;
        this.indexSetRegistry = indexSetRegistry;

    }

    private String addNewIpStreamIfNeedTo(String ip) throws ValidationException {
        String ipStreamId;
        List<Stream> streams = streamService.loadAll();
        for (Stream stream: streams){
            if (stream.getTitle().contains("_IP:") && stream.getTitle().substring(4).equals(ip)){
                ipStreamId = stream.getId();
                return ipStreamId;
            }
        }
        ipStreamId = addNewStream("_IP:"+ip, "auto add ip group "+ip);
        addNewRule(ipStreamId, ip);
        return ipStreamId;
    }

    private void deleteIpStreamIfNeedTo(Stream ipStream, List<AppCenterData> apps) throws NotFoundException {
        boolean found = false;
        for (AppCenterData data: apps){
            for (String ip : data.ipList){
                if (ip.equals(ipStream.getTitle().substring(4))){
                    found = true;
                    break;
                }
            }
            if (found){
                break;
            }
        }
        if (!found){
            streamService.destroy(ipStream);
        }
    }

    private void addIpStreamPermissionIfNeedTo(String streamId, String ipStreamId) throws ValidationException {
        Set<Role> roles;
        try {
            roles = roleService.loadAll();
        } catch (NotFoundException e) {
            roles = Collections.emptySet();
        }
        for (Role role: roles){
            if (role.isReadOnly()){
                continue;
            }
            Set<String> perms = role.getPermissions();
            if (perms.contains("streams:edit:"+streamId) || perms.contains("streams:read:"+streamId)){
                perms.add("streams:edit:"+ipStreamId);
                perms.add("streams:read:"+ipStreamId);
            }
            role.setPermissions(perms);
            roleService.save(role);
        }
    }

    private void addStreamRuleToStream(String streamId, String ip) throws ValidationException {
        addNewRule(streamId, ip);

        String ipStreamId = addNewIpStreamIfNeedTo(ip);

        addIpStreamPermissionIfNeedTo(streamId, ipStreamId);
    }

    private void addNewRule(String streamId, String ip) throws ValidationException {
        final Map<String, Object> streamRuleData = ImmutableMap.<String, Object>builder()
                .put(StreamRuleImpl.FIELD_TYPE, StreamRuleType.EXACT.getValue())
                .put(StreamRuleImpl.FIELD_VALUE, ip)
                .put(StreamRuleImpl.FIELD_FIELD, "HOSTIP")
                .put(StreamRuleImpl.FIELD_INVERTED, false)
                .put(StreamRuleImpl.FIELD_STREAM_ID, new ObjectId(streamId))
                .build();
        streamRuleService.save(new StreamRuleImpl(streamRuleData));
    }

    private String addNewStream(String title, String description) throws ValidationException {
        if (description == null){
            description = "";
        }
        ObjectId id = new ObjectId();
        final IndexSet indexSet = indexSetRegistry.getDefault();
        final Map<String, Object> streamData = ImmutableMap.<String, Object>builder()
                .put(StreamImpl.FIELD_TITLE, title)
                .put(StreamImpl.FIELD_DESCRIPTION, description)
                .put(StreamImpl.FIELD_DISABLED, false)
                .put(StreamImpl.FIELD_MATCHING_TYPE, StreamImpl.MatchingType.OR.name())
                .put(StreamImpl.FIELD_CREATOR_USER_ID, "appcenter")
                .put(StreamImpl.FIELD_CREATED_AT, Tools.nowUTC())
                .put(StreamImpl.FIELD_DEFAULT_STREAM, false)
                .put(StreamImpl.FIELD_INDEX_SET_ID, indexSet.getConfig().id())
                .build();
        Stream stream = new StreamImpl(id, streamData, Collections.emptyList(), Collections.emptySet(), indexSet);
        return streamService.save(stream);
    }

    private void saveNewGroup(AppCenterData data) throws ValidationException {
        String streamId = addNewStream("_Group:"+data.appCnName, data.description);

        for (String ip : data.ipList){
            addStreamRuleToStream(streamId, ip);
        }
    }

    private void deleteRuleFromStream(StreamRule rule, List<AppCenterData> apps) throws NotFoundException {
        streamRuleService.destroy(rule);

        //check if this ip is really deleted in app center
        boolean found = false;
        for (AppCenterData data : apps){
            if (data.ipList.contains(rule.getValue())){
                found = true;
                break;
            }
        }
        if (!found){
            //delete ip stream
            List<Stream> streams = streamService.loadAll();
            for (Stream s : streams){
                if (s.getTitle().contains("_IP:") && s.getTitle().substring(4).equals(rule.getValue()) && !s.isDefaultStream()){
                    streamService.destroy(s);
                }
            }
        }
    }

    private void deleteGroup(Stream group, List<AppCenterData> apps) throws NotFoundException {
        for (StreamRule rule : group.getStreamRules()){
            deleteRuleFromStream(rule, apps);
        }
        streamService.destroy(group);
    }

    private boolean processResponse(List<AppCenterData> apps){
        boolean success = true;
        List<Stream> streams = streamService.loadAll();

        //group and ip streams in db
        List<Stream> groups = Lists.newArrayList();
        for (Stream stream: streams){
            if (stream.getTitle().contains("_Group:")){
                groups.add(stream);
            }
        }

        //add new groups and adjust rules for existed groups
        for (AppCenterData data : apps){
            boolean groupFound = false;
            for (Stream stream : groups){
                if (stream.getTitle().substring(7).equals(data.appCnName)){
                    //found group, check ip to add
                    groupFound = true;
                    for (String ip : data.ipList){
                        boolean ipFound = false;
                        for (StreamRule rule: stream.getStreamRules()){
                            if (rule.getValue().equals(ip)){
                                ipFound = true;
                                break;
                            }
                        }
                        if (!ipFound){
                            try {
                                addStreamRuleToStream(stream.getId(), ip);
                            } catch (ValidationException e) {
                                LOG.error("update group failed! Cannot add ip to exist group. group id {}, group title {}, ip {}",
                                        stream.getId(), data.appCnName, ip, e);
                                success = false;
                            }
                        }
                    }
                    //check ip to delete
                    List<StreamRule> ruleToDelete = Lists.newArrayList();
                    for (StreamRule rule: stream.getStreamRules()){
                        boolean ipFound = false;
                        for (String ip : data.ipList){
                            if (ip.equals(rule.getValue())){
                                ipFound = true;
                                break;
                            }
                        }
                        if (!ipFound){
                            ruleToDelete.add(rule);
                        }
                    }
                    for (StreamRule rule : ruleToDelete){
                        try {
                            deleteRuleFromStream(rule, apps);
                        } catch (NotFoundException e) {
                            LOG.error("update group failed! Cannot delete ip from exist group. group id {}, group title {}, ip {}",
                                    stream.getId(), data.appCnName, rule.getValue(), e);
                            success = false;
                        }
                    }
                    break;
                }
            }
            if (!groupFound){
                try {
                    saveNewGroup(data);
                } catch (ValidationException e) {
                    LOG.error("insert new group failed! Cannot add group. group title {}",
                            data.appCnName, e);
                    success = false;
                }
            }
        }

        //delete deprecated groups
        for (Stream group : groups){
            boolean found = false;
            String title = group.getTitle().substring(7);
            for (AppCenterData data : apps){
                if (data.appCnName.equals(title)){
                    found = true;
                    break;
                }
            }
            if (!found){
                try {
                    deleteGroup(group, apps);
                } catch (NotFoundException e) {
                    LOG.error("delete deprecated group failed! Cannot delete group. group id {},  group title {}",
                            group.getId(), group.getTitle().substring(7), e);
                    success = false;
                }
            }
        }

        List<Stream> streamsNow = streamService.loadAll();
        for (Stream stream: streamsNow){
            if (stream.getTitle().contains("_IP:")){
                try {
                    deleteIpStreamIfNeedTo(stream, apps);
                } catch (NotFoundException e) {
                    LOG.error("delete deprecated IP group failed! Cannot delete group. group id {},  group title {}",
                            stream.getId(), stream.getTitle().substring(4), e);
                    success = false;
                }
            }
        }

        return success;
    }

    public void deleteAllGroups() throws NotFoundException {
        List<Stream> streams = streamService.loadAll();

        //group and ip streams in db
        List<Stream> groups = Lists.newArrayList();
        for (Stream stream: streams){
            if (stream.getTitle().contains("_Group:")){
                groups.add(stream);
            }
        }

        for (Stream group : groups){
            deleteGroup(group, Collections.emptyList());
        }
    }

    @Override
    public void doRun() {
        final Request request = new Request.Builder()
                .addHeader(HttpHeaders.USER_AGENT, USER_AGENT)
                .get()
                .url(configuration.getAppCenterApiAddress().toString())
                .build();
        try(final Response response = httpClient.newCall(request).execute()) {
            if (response.isSuccessful()){
                final AppCenterDataSyncResponse appCenterDataSyncResponse = objectMapper.readValue(response.body().byteStream(), AppCenterDataSyncResponse.class);
                if (appCenterDataSyncResponse.status == 200){
                    if (appCenterDataSyncResponse.total  > 0 && appCenterDataSyncResponse.data.size() > 0){

                        List<AppCenterData> apps = appCenterDataSyncResponse.data;
                        Date begin = new Date();
                        if (!processResponse(apps)){
                            Notification notification = notificationService.buildNow()
                                    .addSeverity(Notification.Severity.URGENT)
                                    .addType(Notification.Type.GENERIC)
                                    .addDetail("error accrued when synchronizing group from app center.", "please checkout the log file of the master node.");
                            notificationService.publishIfFirst(notification);
                        }else {
                            Date end = new Date();
                            long time = end.getTime() - begin.getTime();
                            LOG.error("App center data synchronize successful! time spend: {} ms", time);
                        }

                    }else {
                        LOG.warn("App center data is empty (total app {}, data size {}). All groups will be deleted.", appCenterDataSyncResponse.total, appCenterDataSyncResponse.data.size());
                        try {
                            deleteAllGroups();
                        } catch (NotFoundException e) {
                            Notification notification = notificationService.buildNow()
                                    .addSeverity(Notification.Severity.URGENT)
                                    .addType(Notification.Type.GENERIC)
                                    .addDetail("error accrued when trying to delete all groups(we delete all groups due to empty result fetched from app center).", "please checkout the log file of the master node.");
                            notificationService.publishIfFirst(notification);
                        }
                    }
                }else {
                    LOG.error("App center data synchronize unsuccessful (response status {}, message: {}).", appCenterDataSyncResponse.status, appCenterDataSyncResponse.message);
                }
            }else {
                LOG.error("App center data synchronize unsuccessful (response code {}).", response.code());
            }
        } catch (IOException e) {
            LOG.error("Couldn't perform app center data synchronize", e);
        }

    }

    @Override
    public boolean runsForever() {
        return false;
    }

    @Override
    public boolean stopOnGracefulShutdown() {
        return false;
    }

    @Override
    public boolean masterOnly() {
        return true;
    }

    @Override
    public boolean startOnThisNode() {
        return configuration.isAppCenterEnable();
    }

    @Override
    public boolean isDaemon() {
        return true;
    }

    @Override
    public int getInitialDelaySeconds() {
        return 10;
    }

    @Override
    public int getPeriodSeconds() {
        Duration period = configuration.getAppCenterSyncInterval();
        return (int) period.toSeconds();
    }

    @Override
    protected Logger getLogger() {
        return LOG;
    }

}
