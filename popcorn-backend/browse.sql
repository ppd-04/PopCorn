create table if not exists genres (
    id integer primary key,
    name varchar(100) not null
);

create table if not exists movie_genres (
    movie_id integer not null,
    genre_id integer not null,
    primary key (movie_id, genre_id)
);

insert into genres (id, name) values 
(28, 'action'), (12, 'adventure'), (16, 'animation'), (35, 'comedy'), 
(80, 'crime'), (99, 'documentary'), (18, 'drama'), (10751, 'family'), 
(14, 'fantasy'), (36, 'history'), (27, 'horror'), (10402, 'music'), 
(9648, 'mystery'), (10749, 'romance'), (878, 'science fiction'), 
(10770, 'tv movie'), (53, 'thriller'), (10752, 'war'), (37, 'western')
on conflict (id) do nothing;

-- test 
insert into movie_genres (movie_id, genre_id) values 
(1954, 28), (1954, 35), (1954, 80)
on conflict (movie_id, genre_id) do nothing;

drop materialized view if exists trending_movies_view;
create materialized view trending_movies_view as
select 
    m.id, 
    m.title, 
    m.chobi, 
    m.background, 
    m.overview,
    m.avgrate,
    m.release_date,
    (m.avgrate * log(greatest(m.vote_count, 1))) as trend_score
from movies m
where m.background is not null and m.overview is not null
order by trend_score desc nulls last
limit 500;

create or replace function refresh_trending_view()
returns void as $$
begin
    refresh materialized view trending_movies_view;
end;
$$ language plpgsql;

drop function if exists get_collaborative_recommendations(integer);

create or replace function get_collaborative_recommendations(target_user_id integer)
returns table (
    id bigint,
    title text,
    chobi text,
    background text,
    avgrate numeric
) as $$
declare
    koita integer;
begin
    create temp table if not exists temp_collab_recs (
        id bigint,
        title text,
        chobi
 text,
        background text,
        avgrate numeric
    ) on commit drop;

    truncate temp_collab_recs;

    if target_user_id is not null and target_user_id > 0 then
        insert into temp_collab_recs
        select sub.id, sub.title, sub.chobi
, sub.background, sub.avgrate
        from (
            select distinct m.id, m.title, m.chobi
    , m.background, m.avgrate
            from movie_ratings mr2
            join movies m on m.id = mr2.movie_id
            where mr2.user_id in (
                select distinct mr1.user_id
                from movie_ratings mr1
                where mr1.movie_id in (
                    select movie_id from user_favourites where user_id = target_user_id
                    union all
                    select movie_id from movie_ratings where user_id = target_user_id and rating >= 8.0
                )
                and mr1.user_id != target_user_id
            )
            and mr2.rating >= 8.0
            and m.id not in (select movie_id from user_watched where user_id = target_user_id)
        ) sub
        order by random()
        limit 10;
    end if;

    select count(*) into koita from temp_collab_recs;

    if koita < 10 then
        insert into temp_collab_recs
        select m.id, m.title, m.chobi
, m.background, m.avgrate
        from movies m
        where m.id not in (select cr.id from temp_collab_recs cr)
        and (target_user_id is null or m.id not in (select movie_id from user_watched where user_id = target_user_id))
        and m.avgrate >= 7.5 and m.vote_count > 1000
        order by random()
        limit (10 - koita);
    end if;

    return query select * from temp_collab_recs;
end;
$$ language plpgsql;

drop function if exists get_genre_recommendations(integer);

create or replace function get_genre_recommendations(target_user_id integer)
returns table (
    id bigint,
    title text,
    chobi text,
    background text,
    avgrate numeric
) as $$
declare
    koita integer;
begin
    create temp table if not exists temp_genre_recs (
        id bigint,
        title text,
        chobi
 text,
        background text,
        avgrate numeric
    ) on commit drop;
    
    truncate temp_genre_recs;

    if target_user_id is not null and target_user_id > 0 then
        insert into temp_genre_recs
        select sub.id, sub.title, sub.chobi
, sub.background, sub.avgrate
        from (
            select distinct m.id, m.title, m.chobi
    , m.background, m.avgrate
            from movies m
            join movie_genres mg on m.id = mg.movie_id
            where mg.genre_id in (
                select combined.genre_id
                from (
                    select genre_id, 10 as score
                    from user_interests
                    where user_id = target_user_id
                    union all
                    select mg_inner.genre_id, 1 as score
                    from (
                        select movie_id from user_favourites where user_id = target_user_id
                        union all
                        select movie_id from movie_ratings where user_id = target_user_id and rating >= 8.0
                    ) user_likes
                    join movie_genres mg_inner on user_likes.movie_id = mg_inner.movie_id
                ) combined
                group by combined.genre_id
                order by sum(combined.score) desc
                limit 3
            )
            and m.id not in (select movie_id from user_watched where user_id = target_user_id)
            order by m.avgrate desc nulls last
            limit 100
        ) sub
        order by random()
        limit 10;
    end if;

    select count(*) into koita from temp_genre_recs;

    if koita < 10 then
        insert into temp_genre_recs
        select m.id, m.title, m.chobi
, m.background, m.avgrate
        from movies m
        where m.id not in (select gr.id from temp_genre_recs gr)
        and (target_user_id is null or m.id not in (select movie_id from user_watched where user_id = target_user_id))
        and m.avgrate >= 8.1
        order by random()
        limit (10 - koita);
    end if;

    return query select * from temp_genre_recs;
end;
$$ language plpgsql;

drop function if exists get_recommendations_by_recently_liked(integer);

create or replace function get_recommendations_by_recently_liked(target_user_id integer)
returns table (
    maintitle text,
    id bigint,
    title text,
    chobi text,
    background text,
    avgrate numeric
) as $$
declare
    v_anchor_id bigint;
    v_anchor_title text;
begin
    select sub.movie_id, m.title into v_anchor_id, v_anchor_title
    from (
        select f.movie_id, f.created_at from user_favourites f where f.user_id = target_user_id
        union all
        select r.movie_id, r.created_at from movie_ratings r where r.user_id = target_user_id and r.rating >= 7.0
        order by created_at desc
        limit 10
    ) sub
    join movies m on m.id = sub.movie_id
    where exists (select 1 from movie_genres mg where mg.movie_id = m.id)
    order by random()
    limit 1;

    if v_anchor_id is null then
        return;
    end if;

    return query
    select 
        v_anchor_title::text,
        m.id,
        m.title::text,
        m.chobi
::text,
        m.background::text,
        m.avgrate::numeric
    from movies m
    where m.id != v_anchor_id
    and m.id not in (select w.movie_id from user_watched w where w.user_id = target_user_id)
    and (
        select count(*)
        from movie_genres mg1
        join movie_genres mg2 on mg1.genre_id = mg2.genre_id
        where mg1.movie_id = v_anchor_id
        and mg2.movie_id = m.id
    ) >= 3
    order by m.avgrate desc nulls last
    limit 15;
end;
$$ language plpgsql;