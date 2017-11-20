package org.graylog2.shared.security;

import com.google.common.base.MoreObjects;
import org.apache.shiro.authc.HostAuthenticationToken;

import java.util.Objects;

/**
 * Created by gengxiaotian on 2017/11/20.
 */
public class UCAuthToken implements HostAuthenticationToken {
    private final String userName;
    private final String token;
    private final String host;
    private final String email;

    public UCAuthToken(String userName, String token, String host, String email){
        this.userName = userName;
        this.token = token;
        this.host = host;
        this.email = email;
    }

    @Override
    public String getHost() {
        return host;
    }

    @Override
    public Object getPrincipal() {
        return userName;
    }

    @Override
    public Object getCredentials() {
        return null;
    }

    public String getToken() {
        return token;
    }

    public String getUserName() {
        return userName;
    }

    public String getEmail() {
        return email;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UCAuthToken that = (UCAuthToken) o;
        return Objects.equals(token, that.token) &&
                Objects.equals(host, that.host) &&
                Objects.equals(userName,that.userName) &&
                Objects.equals(email, that.email);
    }

    @Override
    public int hashCode() {
        return Objects.hash(token, host, userName, email);
    }

    @Override
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("token", token)
                .add("host", host)
                .add("userName", userName)
                .add("email", email)
                .toString();
    }
}
