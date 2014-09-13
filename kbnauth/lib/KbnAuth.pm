package KbnAuth;
use Mojo::Base 'Mojolicious';
use KbnAuth::Model::Users;

sub startup {
  my $self = shift;
  my $config = $self->plugin('Config');
  $self->stash(config => $config);
  $self->helper(users => sub {
    state $users = KbnAuth::Model::Users->new($config);
  });

  my $r = $self->routes;

  $r->any('/_nodes')->to('elasticsearch#hidden_nodes');
  $r->any('/_aliases')->to('elasticsearch#proxy');
  $r->any('/*index/temp')->to('elasticsearch#proxy');
  $r->any('/*index/temp/:name')->to('elasticsearch#proxy');
  $r->get('/app/dashboards/:file' => [file => qr/[\w-]+\.js(on)?/])->to('kibana#dashboard');

  $r->any('/')->to('kibana#index')->name('index');;

  my $u = $r->under('/')->to('kibana#logged_in');
  $u->get('/webui')->to('kibana#webui');
  $u->get('/logout')->to('kibana#logout');

  $u->get('/config.js')->to('kibana#config');
  $u->any('/:kbnidx/*dashboard' => [kbnidx => qr/kibana-int-\w+/])->to('elasticsearch#auth_dashboards');
  # TODO: indices auth for Users
  $u->any('/*index/_aliases')->to('elasticsearch#auth_proxy');
  $u->any('/*index/_mapping')->to('elasticsearch#auth_proxy');
  $u->any('/*index/_search')->to('elasticsearch#auth_proxy');
}

1;
