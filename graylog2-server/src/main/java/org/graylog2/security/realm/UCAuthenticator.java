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
package org.graylog2.security.realm;

import com.google.inject.Inject;
import org.apache.shiro.authc.AuthenticationException;
import org.apache.shiro.authc.AuthenticationInfo;
import org.apache.shiro.authc.AuthenticationToken;
import org.apache.shiro.authc.SimpleAccount;
import org.apache.shiro.authc.credential.AllowAllCredentialsMatcher;
import org.apache.shiro.realm.AuthenticatingRealm;
import org.graylog2.Configuration;
import org.graylog2.plugin.database.ValidationException;
import org.graylog2.plugin.database.users.User;
import org.graylog2.shared.security.ShiroSecurityContext;
import org.graylog2.shared.security.UCAuthToken;
import org.graylog2.shared.users.UserService;
import org.graylog2.users.RoleService;
import org.joda.time.DateTimeZone;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.inject.Named;
import java.util.Collections;

import static com.google.common.base.Strings.isNullOrEmpty;

/**
 * Created by gengxiaotian on 2017/11/20.
 */
public class UCAuthenticator extends AuthenticatingRealm {
    private static final Logger LOG = LoggerFactory.getLogger(UCAuthenticator.class);
    public static final String NAME = "auth-from-uc";

    private final RoleService roleService;
    private final DateTimeZone rootTimeZone;
    private final UserService userService;
    private final Configuration configuration;

    @Inject
    UCAuthenticator(UserService userService,
                    RoleService roleService,
                    Configuration configuration,
                    @Named("root_timezone") DateTimeZone rootTimeZone){
        this.userService = userService;
        this.roleService = roleService;
        this.configuration = configuration;
        this.rootTimeZone = rootTimeZone;
        setAuthenticationTokenClass(UCAuthToken.class);
        setCredentialsMatcher(new AllowAllCredentialsMatcher());
        setCachingEnabled(false);
    }

    @Override
    protected AuthenticationInfo doGetAuthenticationInfo(AuthenticationToken authenticationToken) throws AuthenticationException {
        UCAuthToken token = (UCAuthToken) authenticationToken;
        LOG.debug("Retrieving uc authc info for user {}", token.getUserName());
        User user = userService.load(token.getUserName());
        if (user == null) {
            user = userService.create();
            user.setName(token.getUserName());
            user.setExternal(true);
            user.setPassword("dummy password");
            user.setPermissions(Collections.emptyList());
            user.setFullName(token.getUserName());
            user.setTimeZone(rootTimeZone);
            user.setRoleIds(Collections.singleton(roleService.getReaderRoleObjectId()));
        }
        if (!user.isLocalAdmin()) {
            final String email = token.getEmail();
            if (isNullOrEmpty(email)) {
                LOG.debug("No email address found for user {} in UC. Using {}@localhost", token.getUserName(), token.getUserName());
                user.setEmail(token.getUserName() + "@localhost");
            } else {
                user.setEmail(email);
            }
            try {
                userService.save(user);
            } catch (ValidationException e) {
                LOG.error("Unable to save auto created user {}. Not logging in with http header.", user, e);
                return null;
            }
        }
        ShiroSecurityContext.requestSessionCreation(true);
        return new SimpleAccount(token.getUserName(), null, NAME);
    }
}
