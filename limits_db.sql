-- schema for postgrest database used for limits

create table sites (
  id bigserial primary key,
  public_key varchar(30) not null unique,
  auth_key varchar(72) not null,
  created timestamptz not null default current_timestamp,
  site_size int not null default 0,
  user_agent varchar(200),
  ip_address varchar(50)
);
create index idx_site_public_key on sites using btree (public_key);
create index idx_site_auth_key on sites using btree (auth_key);
create index idx_site_created on sites using btree (created);

create or replace function check_new_site(
    public_key text,
    auth_key text,
    max_sites int,
    user_agent varchar(200),
    ip_address varchar(50)
  ) returns int as $$
  declare
    site_count int;
    site_id int;
  begin
    select count(*) into site_count
    from sites
    where sites.auth_key=check_new_site.auth_key and now() - created<interval '24 hours';

    if site_count < max_sites then
      insert into sites (public_key, auth_key, user_agent, ip_address)
      values (check_new_site.public_key, check_new_site.auth_key, check_new_site.user_agent, check_new_site.ip_address)
      on conflict do nothing returning id into site_id;
      if site_id is not null then
        return site_count;
      end if;
    end if;
    return null;
  end;
$$ language plpgsql;

create or replace function check_new_file(public_key text, file_size int, size_limit int) returns integer as $$
  declare
    current_site_size int;
    site_id int;
  begin
    -- we could do some complex locking here, perhaps with "SHARE UPDATE EXCLUSIVE", not sure it's worth its
    select sites.id, sites.site_size into site_id, current_site_size
    from sites
    where sites.public_key=check_new_file.public_key;

    if current_site_size + file_size > size_limit then
      return null;
    else
      update sites set site_size=site_size + file_size where id=site_id returning site_size into current_site_size;
      return current_site_size;
    end if;
  end;
$$ language plpgsql;
