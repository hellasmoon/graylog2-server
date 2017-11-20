package org.graylog2.rest.models.system.sessions.requests;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.google.auto.value.AutoValue;
import org.graylog.autovalue.WithBeanGetter;
import org.hibernate.validator.constraints.NotEmpty;

/**
 * Created by gengxiaotian on 2017/11/20.
 */
@AutoValue
@WithBeanGetter
@JsonAutoDetect
public abstract class SessionCreateFromUCRequest {
    @JsonProperty
    @NotEmpty
    public abstract String username();

    @JsonProperty
    @NotEmpty
    public abstract String token();

    @JsonProperty
    public abstract String host();

    @JsonProperty
    public abstract String email();

    @JsonCreator
    public static SessionCreateFromUCRequest create(@JsonProperty("username") @NotEmpty String username,
                                              @JsonProperty("token") @NotEmpty String token,
                                              @JsonProperty("host") String host,
                                                    @JsonProperty("email") String email) {
        return new AutoValue_SessionCreateFromUCRequest(username, token, host, email);
    }
}
