-- schema for postgrest database used for limits

CREATE TABLE sites (
  id serial primary key,
  public_key varchar(30) not null unique,
  auth_key varchar(72) not null,
  created timestamptz not null default current_timestamp,
  site_size int not null default 0
);
create index idx_site_public_key on sites using btree (public_key);
create index idx_site_auth_key on sites using btree (auth_key);
create index idx_site_created on sites using btree (created);

create or replace function recent_sites(auth_key text) returns int as $$
  declare
    site_count int;
  begin
    select count(*) into site_count
    from sites
    where sites.auth_key=recent_sites.auth_key and now() - created<interval '24 hours';
    return site_count;
  end;
$$ language plpgsql;

create or replace function new_file(public_key text, file_size int, size_limit int) returns integer as $$
  declare
    current_site_size int;
    site_id int;
  begin
    -- we could do some complex locking here, perhaps with "SHARE UPDATE EXCLUSIVE", not sure it's worth its
    select sites.id, sites.site_size into site_id, current_site_size
    from sites
    where sites.public_key=new_file.public_key;

    if current_site_size + file_size > size_limit then
      return null;
    else
      update sites set site_size=site_size + file_size where id=site_id returning site_size into current_site_size;
      return current_site_size;
    end if;
  end;
$$ language plpgsql;
