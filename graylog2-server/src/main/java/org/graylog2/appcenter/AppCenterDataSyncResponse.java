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

package org.graylog2.appcenter;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Created by gengxiaotian on 2017/11/30.
 */
public class AppCenterDataSyncResponse {
    @JsonProperty("status")
    public int status;

    @JsonProperty("message")
    public String message;

    @JsonProperty("total")
    public int total;

    @JsonProperty("data")
    public List<AppCenterData> data;

    @Override
    public String toString() {
        String dataString = "";
        for (AppCenterData data: this.data){
            dataString += data.toString() + "; ";
        }
        return "status: "+status+", message: "+message+", total: "+ total +", data: "+ dataString;
    }
}
